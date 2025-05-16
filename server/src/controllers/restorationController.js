// controllers/restorationController.js
const { v4: uuidv4 } = require('uuid');
const Minio = require('minio');
const db = require('..config/db'); // или ваш модуль/ORM для работы с БД

// Настройка клиента MinIO
const minioClient = new Minio.Client({
  endPoint:   process.env.MINIO_ENDPOINT,
  port:      +process.env.MINIO_PORT  || 9000,
  useSSL:     process.env.MINIO_USE_SSL === 'true',
  accessKey:  process.env.MINIO_ACCESS_KEY,
  secretKey:  process.env.MINIO_SECRET_KEY,
});
const BUCKET = process.env.MINIO_BUCKET || 'restoration';

exports.uploadAudio = async (req, res) => {
    try {
      const { file }   = req;
      const { userId } = req.body;
  
      if (!file)   return res.status(400).json({ error: 'Файл обязателен' });
      if (!userId) return res.status(400).json({ error: 'userId обязателен' });
  
      // Генерируем UUID (альтернатива: можно не генерить и дать БД DEFAULT)
      const id = uuidv4();
      const objectName = `${userId}/${id}-${file.originalname}`;
  
      // Загружаем в MinIO
      await minioClient.putObject(
        BUCKET,
        objectName,
        file.buffer,
        { 'Content-Type': file.mimetype }
      );
  
      // Делаем запись в PostgreSQL через dg.query
      const insertQuery = `
        INSERT INTO public.restorations
          (id, user_id, file_path, status)
        VALUES
          ($1, $2, $3, $4)
        RETURNING id;
      `;
    // Относительный путь или URL для хранения в БД
    const filePath = `${BUCKET}/${objectName}`;
    const values = [id, userId, path, 'uploaded'];
    const { rows } = await dg.query(insertQuery, values);
    // rows[0].id === id

    return res.status(200).json({ id: rows[0].id });
  }
  catch (err) {
    console.error('Ошибка загрузки аудио:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};