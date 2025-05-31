// routes/restoration.js
const express = require("express");
const multer = require("multer");
const ctrl = require("../controllers/restorationController");
const { producer } = require("../services/kafka");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
// храним файл в памяти, чтобы сразу передать его в MinIO
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 70 * 1024 * 1024 },
});

// Загрузка треков
router.post("/upload", upload.single("file"), ctrl.uploadAudio);
// Загрузка метаданных
router.post("/metadata", express.json(), ctrl.uploadMetadata);
// Стриминг (для плеера)
router.get("/stream/:trackId", ctrl.streamTrack);
// Пинги для проверки кафка брокера
router.post("/ping", async (req, res) => {
  try {
    const clientIp = req.ip || "unknown";
    const kafkaKey = uuidv4(); // Генерируем UUID для ключа Kafka
    const message = {
      event: "ping",
      client_ip: clientIp,
      timestamp: new Date().toISOString(),
    };
    await producer.send({
      topic: "app.main.nettools",
      messages: [{ key: kafkaKey, value: JSON.stringify(message) }],
    });
    console.log(`🚀 [Ping] Отправлено в Kafka: key=${kafkaKey}`, message);
    return res.status(200).json({ message: "Ping sent" });
  } catch (e) {
    console.error("❌ [Ping] Ошибка:", e);
    return res.status(500).json({ error: "Ошибка отправки ping" });
  }
});
// Скачивание
router.get("/download/:trackId", ctrl.downloadTrack);
// Проверка на готовность от кафки
router.get("/isReady", ctrl.isReady);
// Получение караоке текста для треков
router.post("/lyrics", express.json(), ctrl.getTrackLyrics);
module.exports = router;
