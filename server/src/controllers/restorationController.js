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
    if (!file || !userId) {
      console.warn("⚠️ [uploadAudio] Отсутствуют file или userId");
      return res.status(400).json({ error: "file и userId обязательны" });
    }

    const id = uuidv4(); // UUID трека
    const objectName = `${userId}/${id}/${file.originalname}`;
    const nfsFilePath = path.join(NFS_PATH, userId, id, `${file.originalname}`);

    // Создаём папку в NFS
    console.log(
      `📁 [uploadAudio] Создание папки в NFS: ${path.join(
        NFS_PATH,
        userId,
        id
      )}`
    );
    await fs.mkdir(path.join(NFS_PATH, userId, id), { recursive: true });

    // Сохраняем файл в NFS
    console.log(`📤 [uploadAudio] Сохранение в NFS: ${nfsFilePath}`);
    await fs.writeFile(nfsFilePath, file.buffer);
    console.log(`✅ [uploadAudio] Файл сохранён в NFS: ${nfsFilePath}`);

    // Сохраняем файл в MinIO
    console.log(`📤 [uploadAudio] Попытка загрузки в MinIO: ${objectName}`);
    await putObjectAsync(BUCKET, objectName, file.buffer, {
      "Content-Type": file.mimetype,
    });
    console.log(
      `✅ [uploadAudio] Файл успешно загружен в MinIO: ${objectName}`
    );

    const minioFilePath = `${BUCKET}/${objectName}`;
    const insert = `
      INSERT INTO public.restorations (id, user_id, file_path_original, status)
      VALUES ($1, $2, $3, 'uploaded')
      RETURNING id;
    `;

    // Сохранение в PostgreSQL
    console.log("📝 [uploadAudio] Попытка записи в PostgreSQL:", {
      id,
      userId,
      filePath: minioFilePath,
    });
    const result = await db.query(insert, [id, userId, minioFilePath]);
    const trackId = result.rows[0].id;
    console.log(
      `✅ [uploadAudio] Запись добавлена в PostgreSQL: id=${trackId}`
    );

    // Отправка сообщения в Kafka с UUID трека как ключом
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
      messages: [{ key: trackId, value: JSON.stringify(message) }], // Используем trackId как ключ
    });
    console.log(
      `🚀 [uploadAudio] Сообщение отправлено в Kafka: key=${trackId}`,
      message
    );

    return res.status(200).json({ id: trackId, filePath: minioFilePath });
  } catch (e) {
    console.error("❌ [uploadAudio] Общая ошибка:", e);
    return res
      .status(500)
      .json({ error: "Ошибка загрузки файла", details: e.message });
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

// === Стриминг ===
exports.streamTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const version = req.query.version || "original";
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
    //Выбор между обработанным и оригиналом
    const { file_path_original, file_path_processed } = result.rows[0];
    let path;

    if (version === "processed" && file_path_processed) {
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
    //разбиение на октеты, для парциального стриминга
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

// === Скачивание трека ===
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
// Получение транскрипции трека из бд
exports.getTrackLyrics = async (req, res) => {
  const { trackId } = req.body;
  if (!trackId) {
    return res.status(400).json({ error: "trackId обязателен" });
  }
  const cacheKey = `trackLyrics:${trackId}`;
  try {
    const result = await getCached(
      cacheKey,
      async () => {
        // Проверяем существование трека
        const track = await db.query(
          "SELECT 1 FROM public.restorations WHERE id = $1",
          [trackId]
        );
        if (track.rowCount === 0) {
          return { error: "Трек не найден", status: 404 };
        }
        // Получаем lyrics из restoration_metadata
        const { rows } = await db.query(
          `SELECT lyrics
           FROM public.restoration_metadata
           WHERE restoration_id = $1`,
          [trackId]
        );
        if (rows.length === 0) {
          return { error: "Lyrics не найдены для данного трека", status: 404 };
        }
        return { lyrics: rows[0].lyrics };
      },
      300
    );
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`Ошибка getTrackLyrics ${trackId}:`, err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};
//Если обработка завершена, путь до processed != NULL -> обработка завершена, отправляем
//оповещение на фронт, в противном случае - "still processing"
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
    console.log(
      `ℹ️ [isReady] Путь к реставрированному файлу: ${
        filePathProcessed || "отсутствует"
      }`
    );

    if (!filePathProcessed) {
      return res.status(200).json({ status: "still processing" });
    } else {
      return res.status(200).json({ status: "finalized" });
    }
  } catch (err) {
    console.error(
      `❌ [isReady] Ошибка проверки статуса trackId=${trackId}:`,
      err
    );
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};
