const { v4: uuidv4 } = require('uuid');
const sharp           = require('sharp');
const Minio           = require('minio');
const dg              = require('../dg');

const minioClient = new Minio.Client({
  endPoint:   process.env.MINIO_ENDPOINT,
  port:       +process.env.MINIO_PORT  || 9000,
  useSSL:     process.env.MINIO_USE_SSL === 'true',
  accessKey:  process.env.MINIO_ACCESS_KEY,
  secretKey:  process.env.MINIO_SECRET_KEY,
});
const BUCKET = process.env.MINIO_BUCKET || 'restoration';

// /restoration/upload Загрузка аудиофайла
exports.uploadAudio = async (req, res) => {
  try {
    const { file }   = req;
    const { userId } = req.body;
    if (!file || !userId) {
      return res.status(400).json({ error: 'file и userId обязательны' });
    }

    const id = uuidv4();
    const objectName = `${userId}/${id}-${file.originalname}`;
    await minioClient.putObject(
      BUCKET, objectName, file.buffer, { 'Content-Type': file.mimetype }
    );
    const filePath = `${BUCKET}/${objectName}`;

    const insert = `
      INSERT INTO public.restorations (id, user_id, file_path, status)
      VALUES ($1,$2,$3,'uploaded')
      RETURNING id;
    `;
    const { rows } = await dg.query(insert, [id, userId, filePath]);
    return res.status(200).json({ id: rows[0].id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
};

// /restoration/metadata Приём метаданных
exports.uploadMetadata = async (req, res) => {
  try {
    const {
      trackId, title, author, year,
      album, country, coverUrl
    } = req.body;
    if (!trackId) {
      return res.status(400).json({ error: 'trackId обязателен' });
    }

    // 2.1) Конвертируем обложку, если есть
    let coverPath = null;
    if (coverUrl) {
      const match = coverUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!match) return res.status(400).json({ error: 'Неверный coverUrl' });
      const imgBuf = Buffer.from(match[1], 'base64');
      const pngBuf = await sharp(imgBuf).png().toBuffer();
      const objName = `covers/${trackId}.png`;
      await minioClient.putObject(BUCKET, objName, pngBuf, { 'Content-Type':'image/png' });
      coverPath = `${BUCKET}/${objName}`;
    }

    // 2.2) Вставляем в новую таблицу metadata
    const insertMeta = `
      INSERT INTO public.restoration_metadata
        (restoration_id, title, author, year, album, country, cover_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id;
    `;
    const vals = [trackId, title, author, year, album, country, coverPath];
    const { rows } = await dg.query(insertMeta, vals);

    return res.status(200).json({ metadataId: rows[0].id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка при сохранении метаданных' });
  }
};
