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

/**
 * POST /restoration/upload
 * body (multipart/form-data):
 *  - file: аудиофайл
 *  - userId: строковый идентификатор пользователя
 */
router.post("/upload", upload.single("file"), ctrl.uploadAudio);
router.post("/metadata", express.json(), ctrl.uploadMetadata);
// Стриминг (для плеера)
router.get("/stream/:trackId", ctrl.streamTrack);
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
// Скачивание (attachment)
router.get("/download/:trackId", ctrl.downloadTrack);

router.get("/isReady", ctrl.isReady);
router.post("/lyrics", express.json(), ctrl.getTrackLyrics);
module.exports = router;
