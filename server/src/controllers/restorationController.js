const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const Minio = require("minio");
const db = require("../config/db");
const { producer } = require("../services/kafka");
const fs = require("fs").promises;
const path = require("path");
const {
  getCached,
  invalidateCache,
  invalidateCacheByPrefix,
} = require("../utils/RedisCache");

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: +process.env.MINIO_PORT || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET = process.env.MINIO_BUCKET || "original";
const NFS_PATH = "/nfs/shared";
// Промисификация putObject
function putObjectAsync(bucket, objectName, buffer, metaData) {
  return new Promise((resolve, reject) => {
    minioClient.putObject(bucket, objectName, buffer, metaData, (err, etag) => {
      if (err) return reject(err);
      resolve(etag);
    });
  });
}

// Промисификация presignedGetObject
function presignedGetAsync(bucket, objectName, expires = 3600) {
  return new Promise((resolve, reject) => {
    minioClient.presignedGetObject(bucket, objectName, expires, (err, url) => {
      if (err) return reject(err);
      resolve(url);
    });
  });
}

// === 1. Загрузка аудиофайла ===
exports.uploadAudio = async (req, res) => {
  console.log("📡 [uploadAudio] Запрос получен на сервер");
  console.log("📥 [uploadAudio] Данные запроса:", {
    body: req.body,
    file: req.file
      ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }
      : null,
  });

  try {
    const { file } = req;
    const { userId, artist, songName } = req.body;

    // Проверка наличия file и userId
    if (!file || !userId) {
      console.warn("⚠️ [uploadAudio] Отсутствуют file или userId");
      return res.status(400).json({ error: "file и userId обязательны" });
    }

    // Получение роли пользователя из базы данных
    const userResult = await db.query("SELECT role FROM public.users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) {
      console.warn("⚠️ [uploadAudio] Пользователь не найден");
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    const userRole = userResult.rows[0].role;

    // Проверка, является ли роль пользователя "pro"
    if (userRole !== 'pro') {
      console.warn("⚠️ [uploadAudio] Недостаточно прав");
      return res.status(418).json({ error: "You don't have this functionality" });
    }

    // Генерация UUID для трека
    const id = uuidv4();
    const objectName = `${userId}/${id}/${file.originalname}`;
    const nfsFilePath = path.join(NFS_PATH, userId, id, `${file.originalname}`);
    const processedFilePath = `original/1/43d42004-6524-49b2-81b5-ae68135a6bb4/k_r.mp3`; // Захардкодили путь

    // Создание папки в NFS
    console.log(`📁 [uploadAudio] Создание папки в NFS: ${path.join(NFS_PATH, userId, id)}`);
    await fs.mkdir(path.join(NFS_PATH, userId, id), { recursive: true });

    // Сохранение файла в NFS
    console.log(`📤 [uploadAudio] Сохранение в NFS: ${nfsFilePath}`);
    await fs.writeFile(nfsFilePath, file.buffer);
    console.log(`✅ [uploadAudio] Файл сохранён в NFS: ${nfsFilePath}`);

    // Сохранение файла в MinIO
    console.log(`📤 [uploadAudio] Попытка загрузки в MinIO: ${objectName}`);
    await putObjectAsync(BUCKET, objectName, file.buffer, {
      "Content-Type": file.mimetype,
    });
    console.log(`✅ [uploadAudio] Файл успешно загружен в MinIO: ${objectName}`);

    const minioFilePath = `${BUCKET}/${objectName}`;
    const insert = `
      INSERT INTO public.restorations (id, user_id, file_path_original, file_path_processed, status)
      VALUES ($1, $2, $3, $4, 'uploaded')
      RETURNING id;
    `;

    // Сохранение в PostgreSQL с захардкодленным file_path_processed
    console.log("📝 [uploadAudio] Попытка записи в PostgreSQL:", { id, userId, filePath: minioFilePath, processedFilePath });
    const result = await db.query(insert, [id, userId, minioFilePath, processedFilePath]);
    const trackId = result.rows[0].id;
    console.log(`✅ [uploadAudio] Запись добавлена в PostgreSQL: id=${trackId}`);

    // Отправка сообщения в Kafka
    const message = {
      event: "audio_uploaded",
      client_ip: req.ip || "unknown",
      id: trackId,
      userId,
      filePath: nfsFilePath,
      originalName: file.originalname,
      mimeType: file.mimetype,
      artist,
      songName,
      createdAt: new Date().toISOString(),
    };
    console.log("📤 [uploadAudio] Попытка отправки в Kafka:", message);
    await producer.send({
      topic: "app.main.audio_raw",
      messages: [{ key: trackId, value: JSON.stringify(message) }],
    });
    console.log(`🚀 [uploadAudio] Сообщение отправлено в Kafka: key=${trackId}`, message);

    return res.status(200).json({ id: trackId, filePath: minioFilePath });
  } catch (e) {
    console.error("❌ [uploadAudio] Общая ошибка:", e);
    return res.status(500).json({ error: "Ошибка загрузки файла", details: e.message });
  }
};
// === 2. Сохранение метаданных ===
exports.uploadMetadata = async (req, res) => {
  console.log("📡 [uploadMetadata] Запрос получен:", req.body);

  try {
    const {
      trackId,
      title = null,
      author = null,
      year = null,
      album = null,
      country = null,
      coverUrl = null,
    } = req.body;

    if (!trackId) {
      console.warn("⚠️ [uploadMetadata] Отсутствует trackId");
      return res.status(400).json({ error: "trackId обязателен" });
    }

    let coverBase64 = null;
    if (coverUrl) {
      const match = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        console.warn("⚠️ [uploadMetadata] Неверный формат coverUrl");
        return res
          .status(400)
          .json({ error: "Неверный формат coverUrl, ожидается data URI" });
      }

      const mimeType = match[1];
      const base64Data = match[2];
      const acceptableFormats = ["image/jpeg", "image/png"];

      if (acceptableFormats.includes(mimeType)) {
        coverBase64 = coverUrl;
      } else {
        const imgBuf = Buffer.from(base64Data, "base64");
        const pngBuf = await sharp(imgBuf).png().toBuffer();
        coverBase64 = `data:image/png;base64,${pngBuf.toString("base64")}`;
      }
    }

    const insertMeta = `
      INSERT INTO public.restoration_metadata
        (restoration_id, title, author, year, album, country, cover_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const vals = [trackId, title, author, year, album, country, coverBase64];

    console.log("📝 [uploadMetadata] Запись в PostgreSQL:", vals);
    const { rows } = await db.query(insertMeta, vals);
    console.log(`✅ [uploadMetadata] Метаданные сохранены: id=${rows[0].id}`);

    return res.status(200).json({ metadataId: rows[0].id });
  } catch (e) {
    console.error("❌ [uploadMetadata] Ошибка:", e);
    return res.status(500).json({ error: "Ошибка при сохранении метаданных" });
  }
};

// === 3. Генерация подписанного URL для скачивания ===
async function resolveObject(trackId, version) {
  console.log(
    `🔍 [resolveObject] Поиск трека: trackId=${trackId}, version=${version}`
  );
  const { rows } = await db.query(
    `SELECT file_path_original, file_path_processed
       FROM public.restorations
      WHERE id = $1`,
    [trackId]
  );
  if (!rows.length) {
    console.warn("⚠️ [resolveObject] Трек не найден");
    throw { status: 404, message: "Трек не найден" };
  }
  const { file_path_original, file_path_processed } = rows[0];
  if (version === "original") return file_path_original;
  if (version === "processed" && file_path_processed)
    return file_path_processed;
  if (!version && file_path_processed) return file_path_processed;
  return file_path_original;
}

// === 1) Streaming with Range support ===
exports.streamTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const version = req.query.version || 'original';
    console.log(
      `📡 [streamTrack] Запрос стриминга: trackId=${trackId}, version=${version}`
    );

    // Получаем путь к файлу из базы данных
    const result = await db.query(
      `SELECT file_path_original, file_path_processed 
       FROM public.restorations 
       WHERE id = $1`,
      [trackId]
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️ [streamTrack] Трек не найден: trackId=${trackId}`);
      res.status(404).json({ error: "Трек не найден" });
      return;
    }

    const { file_path_original, file_path_processed } = result.rows[0];
    let path;

    if (version === 'processed' && file_path_processed) {
      path = file_path_processed;
    } else {
      path = file_path_original;
    }

    const [bucket, ...parts] = path.split("/");
    const objectName = parts.join("/");

    // Инкремент play_count
    await db.query(
      "UPDATE public.public_library SET play_count = play_count + 1 WHERE track_id = $1",
      [trackId]
    );

    const stat = await minioClient.statObject(bucket, objectName);
    const total = stat.size;

    const range = req.headers.range;
    let start = 0,
      end = total - 1,
      statusCode = 200;

    if (range) {
      const matches = /bytes=(\d+)-(\d*)/.exec(range);
      if (matches) {
        statusCode = 206;
        start = parseInt(matches[1], 10);
        end = matches[2] ? parseInt(matches[2], 10) : end;

        if (start >= total || start > end) {
          console.warn(`⚠️ [streamTrack] Неверный диапазон: ${range}`);
          res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
          return;
        }
      }
    }

    const chunkSize = end - start + 1;
    console.log(
      `📤 [streamTrack] Стриминг: start=${start}, end=${end}, chunkSize=${chunkSize}`
    );

    res.status(statusCode);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", chunkSize);
    res.setHeader(
      "Content-Type",
      stat.metaData["content-type"] || "application/octet-stream"
    );
    if (statusCode === 206) {
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    }

    const stream = await minioClient.getPartialObject(
      bucket,
      objectName,
      start,
      chunkSize
    );
    stream.on("error", (err) => {
      console.error("❌ [streamTrack] Ошибка стриминга:", err);
      if (!res.headersSent) res.sendStatus(500);
    });

    stream.pipe(res);
  } catch (err) {
    console.error("❌ [streamTrack] Ошибка:", err);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Внутренняя ошибка" });
  }
};
// === 2) Download (attachment) ===
exports.downloadTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const version = req.query.version;
    console.log(
      `📡 [downloadTrack] Запрос скачивания: trackId=${trackId}, version=${version}`
    );

    const path = await resolveObject(trackId, version);
    const [bucket, ...parts] = path.split("/");
    const objectName = parts.join("/");

    const stream = await minioClient.getObject(bucket, objectName);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(objectName)}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");
    stream.pipe(res);
    stream.on("error", (err) => {
      console.error("❌ [downloadTrack] Ошибка скачивания:", err);
      if (!res.headersSent) res.sendStatus(500);
    });
  } catch (err) {
    console.error("❌ [downloadTrack] Ошибка:", err);
    res
      .status(err.status || 500)
      .json({ error: err.message || "Внутренняя ошибка" });
  }
};

exports.getTrackLyrics = async (req, res) => {
  const { trackId } = req.body;
  if (!trackId) {
    return res.status(400).json({ error: "trackId обязателен" });
  }
  try {
    // Проверяем существование трека
    const track = await db.query(
      "SELECT 1 FROM public.restorations WHERE id = $1",
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: "Трек не найден" });
    }
    // Получаем lyrics из restoration_metadata
    const { rows } = await db.query(
      `SELECT lyrics
       FROM public.restoration_metadata
       WHERE restoration_id = $1`,
      [trackId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Lyrics не найдены для данного трека" });
    }
    return res.status(200).json({ lyrics: rows[0].lyrics });
  } catch (err) {
    console.error(`Ошибка getTrackLyrics ${trackId}:`, err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};


exports.isReady = async (req, res) => {
  const { trackId } = req.query;
  console.log(`📡 [isReady] Проверка статуса: trackId=${trackId}`);
  
  if (!trackId) {
    console.warn("⚠️ [isReady] Отсутствует trackId");
    return res.status(400).json({ error: "trackId обязателен" });
  }

  try {
    const result = await db.query(
      "SELECT file_path_processed FROM public.restorations WHERE id = $1",
      [trackId]
    );

    if (result.rowCount === 0) {
      console.warn(`⚠️ [isReady] Трек не найден: trackId=${trackId}`);
      return res.status(404).json({ error: "Трек не найден" });
    }

    const filePathProcessed = result.rows[0].file_path_processed;
    console.log(`ℹ️ [isReady] Путь к реставрированному файлу: ${filePathProcessed || 'отсутствует'}`);

    if (!filePathProcessed) {
      return res.status(200).json({ status: "still processing" });
    } else {
      return res.status(200).json({ status: "finalized" });
    }
  } catch (err) {
    console.error(`❌ [isReady] Ошибка проверки статуса trackId=${trackId}:`, err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};