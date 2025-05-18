// routes/restoration.js
const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/restorationController');

const router = express.Router();
// храним файл в памяти, чтобы сразу передать его в MinIO
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 70 * 1024 * 1024 } });

/**
 * POST /restoration/upload
 * body (multipart/form-data):
 *  - file: аудиофайл
 *  - userId: строковый идентификатор пользователя
 */
router.post('/upload',   upload.single('file'), ctrl.uploadAudio);
router.post('/metadata', express.json(),        ctrl.uploadMetadata);
// Стриминг (для плеера)
router.get('/stream/:trackId', ctrl.streamTrack);

// Скачивание (attachment)
router.get('/download/:trackId', ctrl.downloadTrack);

router.get('/isReady', ctrl.isReady)
module.exports = router;
