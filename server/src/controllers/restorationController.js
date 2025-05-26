const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const Minio = require("minio");
const db = require("../config/db");
const { producer } = require("../services/kafka");
const fs = require("fs").promises;
const path = require("path");

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: +process.env.MINIO_PORT || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET = process.env.MINIO_BUCKET || "original";
const NFS_PATH = "/mnt/nfs_share";
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
    const { userId } = req.body;
    if (!file || !userId) {
      console.warn("⚠️ [uploadAudio] Отсутствуют file или userId");
      return res.status(400).json({ error: "file и userId обязательны" });
    }

    const id = uuidv4();
    const objectName = `${userId}/${id}-${file.originalname}`;
    const nfsFilePath = path.join(
      NFS_PATH,
      userId,
      `${id}-${file.originalname}`
    );

    // Создаём папку в NFS, если не существует
    console.log(
      `📁 [uploadAudio] Создание папки в NFS: ${path.join(NFS_PATH, userId)}`
    );
    await fs.mkdir(path.join(NFS_PATH, userId), { recursive: true });

    // Сохраняем файл в NFS
    console.log(`📤 [uploadAudio] Сохранение в NFS: ${nfsFilePath}`);
    await fs.writeFile(nfsFilePath, file.buffer);
    console.log(`✅ [uploadAudio] Файл сохранён в NFS: ${nfsFilePath}`);

    // Сохраняем файл в MinIO
    console.log(`📤 [uploadAudio] Попытка загрузки в MinIO: ${objectName}`);
    try {
      await putObjectAsync(BUCKET, objectName, file.buffer, {
        "Content-Type": file.mimetype,
      });
      console.log(
        `✅ [uploadAudio] Файл успешно загружен в MinIO: ${objectName}`
      );
    } catch (minioError) {
      console.error("❌ [uploadAudio] Ошибка MinIO:", minioError);
      throw minioError;
    }

    const minioFilePath = `${BUCKET}/${objectName}`;
    const insert = `
      INSERT INTO public.restorations (id, user_id, file_path_original, status)
      VALUES ($1, $2, $3, 'uploaded')
      RETURNING id;
    `;

    // Сохранение в PostgreSQL (путь до NFS)
    console.log("📝 [uploadAudio] Попытка записи в PostgreSQL:", {
      id,
      userId,
      filePath: nfsFilePath,
    });
    let rows;
    try {
      const result = await db.query(insert, [id, userId, minioFilePath]);
      rows = result.rows;
      console.log(
        `✅ [uploadAudio] Запись добавлена в PostgreSQL: id=${rows[0].id}`
      );
    } catch (dbError) {
      console.error("❌ [uploadAudio] Ошибка PostgreSQL:", dbError);
      throw dbError;
    }

    // Отправка сообщения в Kafka
    const message = {
      id: rows[0].id,
      userId,
      filePath: nfsFilePath, // Путь до NFS
      originalName: file.originalname,
      mimeType: file.mimetype,
      createdAt: new Date().toISOString(),
    };
    console.log("📤 [uploadAudio] Попытка отправки в Kafka:", message);
    try {
      await producer.send({
        topic: "app.main.audio_raw",
        messages: [{ value: JSON.stringify(message) }],
      });
      console.log(`🚀 [uploadAudio] Сообщение отправлено в Kafka:`, message);
    } catch (kafkaError) {
      console.error("❌ [uploadAudio] Ошибка Kafka:", kafkaError);
      throw kafkaError;
    }

    return res.status(200).json({ id: rows[0].id, filePath: minioFilePath });
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

// === 1) Streaming with Range support ===
exports.streamTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const version = req.query.version;
    console.log(
      `📡 [streamTrack] Запрос стриминга: trackId=${trackId}, version=${version}`
    );

    const path = await resolveObject(trackId, version);
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

exports.isReady = (req, res) => {
  const { trackId } = req.query;
  console.log(`📡 [isReady] Проверка статуса: trackId=${trackId}`);
  if (!trackId) {
    console.warn("⚠️ [isReady] Отсутствует trackId");
    return res.status(400).json({ error: "trackId обязателен" });
  }
  return res.sendStatus(200);
};
