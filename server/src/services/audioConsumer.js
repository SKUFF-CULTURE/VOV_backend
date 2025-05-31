const { Kafka } = require("kafkajs");
const db = require("../config/db");
const fs = require("fs").promises;
const path = require("path");
const Minio = require("minio");

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: +process.env.MINIO_PORT || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

function putObjectAsync(bucket, objectName, buffer, metaData) {
  return new Promise((resolve, reject) => {
    minioClient.putObject(bucket, objectName, buffer, metaData, (err, etag) => {
      if (err) return reject(err);
      resolve(etag);
    });
  });
}

const kafka = new Kafka({
  clientId: "audio-processing-service",
  brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
});
//Инициализация консьюмера кафки
const consumer = kafka.consumer({ groupId: "audio-processing-group" });
//Подписка на топик консьюмера для получения трека от ml пайплайна
const runConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "app.main.audio_recognised", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const trackUuid = message.key.toString(); // UUID трека
      const payload = JSON.parse(message.value.toString());
      const { final_path, lyrics, llm_decision } = payload;

      console.log(`📥 [audioConsumer] Получено сообщение для трека ${trackUuid}`);

      try {
        if (llm_decision.is_nsfw) {
          // Трек NSFW: удаляем из NFS и БД
          await fs.unlink(final_path);
          console.log(`🗑️ [audioConsumer] Трек ${trackUuid} удалён из NFS (NSFW)`);

          await db.query("DELETE FROM public.restorations WHERE id = $1", [trackUuid]);
          console.log(`🗑️ [audioConsumer] Трек ${trackUuid} удалён из БД (NSFW)`);
        } else {
          // Трек не NSFW: загружаем в MinIO, обновляем БД, удаляем из NFS

          // 1. Получаем user_id и file_path_original из БД
          const { rows } = await db.query(
            "SELECT user_id, file_path_original FROM public.restorations WHERE id = $1",
            [trackUuid]
          );
          if (rows.length === 0) {
            console.error(`⚠️ [audioConsumer] Трек ${trackUuid} не найден в БД`);
            return;
          }
          const { user_id, file_path_original } = rows[0];

          // 2. Извлекаем originalname из file_path_original
          const originalname = path.basename(file_path_original);

          // 3. Формируем objectName для MinIO
          const objectName = `${user_id}/${trackUuid}/${originalname}`;

          // 4. Загружаем файл из NFS в MinIO (бакет "processed")
          const fileBuffer = await fs.readFile(final_path);
          await putObjectAsync("processed", objectName, fileBuffer, {
            "Content-Type": "audio/mpeg", // Укажи нужный mime-type, если отличается
          });
          console.log(`✅ [audioConsumer] Файл загружен в MinIO: processed/${objectName}`);

          // 5. Обновляем file_path_processed в restorations
          const minioProcessedPath = `processed/${objectName}`;
          await db.query(
            `UPDATE public.restorations
             SET file_path_processed = $1,
                 status = 'processed'
             WHERE id = $2`,
            [minioProcessedPath, trackUuid]
          );
          console.log(`✅ [audioConsumer] restorations обновлён для трека ${trackUuid}`);

          // 6. Обновляем или вставляем lyrics и tags в restoration_metadata
          const metadataQuery = `
            INSERT INTO public.restoration_metadata (restoration_id, lyrics, tags)
            VALUES ($1, $2, $3)
            ON CONFLICT (restoration_id)
            DO UPDATE SET lyrics = $2, tags = $3
          `;
          await db.query(metadataQuery, [
            trackUuid,
            JSON.stringify(lyrics),
            JSON.stringify(llm_decision.tags),
          ]);
          console.log(`✅ [audioConsumer] restoration_metadata обновлён для трека ${trackUuid}`);

          // 7. Удаляем файл из NFS
          await fs.unlink(final_path);
          console.log(`🗑️ [audioConsumer] Файл удалён из NFS: ${final_path}`);
        }
      } catch (error) {
        console.error(`❌ [audioConsumer] Ошибка при обработке трека ${trackUuid}:`, error);
      }
    },
  });
};

module.exports = { runConsumer };