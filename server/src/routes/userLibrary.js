// routes/userLibrary.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userLibraryController");

// добавить в библиотеку:
// POST /users/library
// Body: { userId, trackId }
router.post("/library", express.json(), ctrl.addToLibrary);

// получить всю библиотеку пользователя:
// POST /users/library/list
// Body: { userId }
router.post("/library/list", express.json(), ctrl.getLibrary);
router.delete("/library", express.json(), ctrl.removeFromLibrary);
router.post("/tags", express.json(), ctrl.getTracksByTags); // Новый маршрут
module.exports = router;
