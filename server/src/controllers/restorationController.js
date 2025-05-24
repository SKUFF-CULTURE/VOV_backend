// controllers/restorationController.js
const { v4: uuidv4 }  = require('uuid');
const sharp           = require('sharp');
const Minio           = require('minio');
const db              = require('../config/db');
const {producer}      = require('../services/kafka')
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port:       +process.env.MINIO_PORT  || 9000,
  useSSL:     process.env.MINIO_USE_SSL === 'true',
  accessKey:  process.env.MINIO_ACCESS_KEY,
  secretKey:  process.env.MINIO_SECRET_KEY,
});

const BUCKET = process.env.MINIO_BUCKET || 'original';

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
  exports.uploadAudio = async (req, res) => {
  console.log('BODY (uploadAudio):', req.body);
  console.log('FILE (uploadAudio):', req.file);

  try {
    const { file } = req;
    const { userId } = req.body;
    if (!file || !userId) {
      return res.status(400).json({ error: 'file и userId обязательны' });
    }

    const id = uuidv4();
    const objectName = `${userId}/${id}-${file.originalname}`;

    // Загрузка файла в S3 (MinIO)
    await putObjectAsync(
      BUCKET,
      objectName,
      file.buffer,
      { 'Content-Type': file.mimetype }
    );

    const filePath = `${BUCKET}/${objectName}`;
    const insert = `
      INSERT INTO public.restorations (id, user_id, file_path_original, status)
      VALUES ($1, $2, $3, 'uploaded')
      RETURNING id;
    `;

    // Сохранение в PostgreSQL
    const { rows } = await db.query(insert, [id, userId, filePath]);

    // Отправка сообщения в Kafka
    await producer.send({
      topic: 'audio-processing', // Имя топика
      messages: [
        {
          value: JSON.stringify({
            id: rows[0].id,
            userId,
            filePath,
            originalName: file.originalname,
            mimeType: file.mimetype,
            createdAt: new Date().toISOString(),
          }),
        },
      ],
    });
    console.log(`Сообщение отправлено в Kafka для файла ${filePath}`);

    return res.status(200).json({ id: rows[0].id });
  } catch (e) {
    console.error('Ошибка uploadAudio:', e);
    return res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
  }
};

// === 2. Сохранение метаданных ===
exports.uploadMetadata = async (req, res) => {
  console.log('BODY (uploadMetadata):', req.body);

  try {
    const {
      trackId,
      title = null,
      author = null,
      year = null,
      album = null,
      country = null,
      coverUrl = null
    } = req.body;

    if (!trackId) {
      return res.status(400).json({ error: 'trackId обязателен' });
    }

    let coverBase64 = null;
    if (coverUrl) {
      // Проверяем, что coverUrl — это валидный Data URI
      const match = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Неверный формат coverUrl, ожидается data URI' });
      }

      const mimeType = match[1]; // Например, 'image/jpeg' или 'image/png'
      const base64Data = match[2]; // Сама строка base64

      // Список допустимых форматов
      const acceptableFormats = ['image/jpeg', 'image/png'];

      if (acceptableFormats.includes(mimeType)) {
        // Формат подходит, оставляем исходную строку
        coverBase64 = coverUrl;
      } else {
        // Формат не подходит, декодируем и конвертируем в PNG
        const imgBuf = Buffer.from(base64Data, 'base64');
        const pngBuf = await sharp(imgBuf).png().toBuffer();
        coverBase64 = `data:image/png;base64,${pngBuf.toString('base64')}`;
      }
    }

    // Сохраняем данные в базу
    const insertMeta = `
      INSERT INTO public.restoration_metadata
        (restoration_id, title, author, year, album, country, cover_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const vals = [
      trackId,
      title,
      author,
      year,
      album,
      country,
      coverBase64
    ];

    const { rows } = await db.query(insertMeta, vals);
    return res.status(200).json({ metadataId: rows[0].id });
  } catch (e) {
    console.error('Ошибка uploadMetadata:', e);
    return res.status(500).json({ error: 'Ошибка при сохранении метаданных' });
  }
};

// === 3. Генерация подписанного URL для скачивания ===
// Промисификатор presignedbetObject
async function resolveObject(trackId, version) {
  const { rows } = await db.query(
    `SELECT file_path_original, file_path_processed
       FROM public.restorations
      WHERE id = $1`, [trackId]
  );
  if (!rows.length) throw { status: 404, message: 'Трек не найден' };
  const { file_path_original, file_path_processed } = rows[0];
  if (version === 'original') return file_path_original;
  if (version === 'processed' && file_path_processed) return file_path_processed;
  if (!version && file_path_processed) return file_path_processed;
  return file_path_original;
}

// === 1) Streaming with Range support ===
exports.streamTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const version     = req.query.version;
    const path        = await resolveObject(trackId, version);
    const [bucket, ...parts] = path.split('/');
    const objectName  = parts.join('/');

    // Инкремент play_count
    await db.query(
      'UPDATE public.public_library SET play_count = play_count + 1 WHERE track_id = $1',
      [trackId]
    );

    // Получаем полную информацию об объекте
    const stat  = await minioClient.statObject(bucket, objectName);
    const total = stat.size;

    // Разбираем заголовок Range
    const range = req.headers.range;
    let start = 0, end = total - 1, statusCode = 200;

    if (range) {
      const matches = /bytes=(\d+)-(\d*)/.exec(range);
      if (matches) {
        statusCode = 206;
        start = parseInt(matches[1], 10);
        end   = matches[2] ? parseInt(matches[2], 10) : end;

        // Если запрошенный диапазон за пределами — отвечаем 416
        if (start >= total || start > end) {
          res.status(416)
             .setHeader('Content-Range', `bytes */${total}`)
             .end();
          return;
        }
      }
    }

    const chunkSize = end - start + 1;

    // Устанавливаем заголовки
    res.status(statusCode);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
    if (statusCode === 206) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    }

    // Правильно запрашиваем нужный диапазон у MinIO
    // (см. метод getPartialObject в MinIO JS SDK) :contentReference[oaicite:0]{index=0}
    const stream = await minioClient.getPartialObject(bucket, objectName, start, chunkSize);

    stream.on('error', err => {
      console.error('Stream error:', err);
      if (!res.headersSent) res.sendStatus(500);
    });

    // Отдаём стрим клиенту
    stream.pipe(res);

  } catch (err) {
    console.error('Ошибка streamTrack:', err);
    res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка' });
  }
};

// === 2) Download (attachment) ===
exports.downloadTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const version     = req.query.version; 
    const path        = await resolveObject(trackId, version);
    const [bucket, ...parts] = path.split('/');
    const objectName = parts.join('/');

    // Получаем объект как поток
    const stream = await minioClient.getObject(bucket, objectName);
    // Заголовки для скачивания
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(objectName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    stream.pipe(res);
    stream.on('error', err => {
      console.error('Download stream error:', err);
      if (!res.headersSent) res.sendStatus(500);
    });
  } catch (err) {
    console.error('Ошибка downloadTrack:', err);
    res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка' });
  }
};


exports.isReady = (req, res) => {
  const { trackId } = req.query;
  if (!trackId) {
    return res.status(400).json({ error: 'trackId обязателен' });
  }
  // Здесь в будущем будет проверка статуса обработки в БД/очереди
  return res.sendStatus(200);
};
