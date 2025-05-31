const express = require("express");
const router = express.Router();
const {
  addPublicTrack,
  getAllPublicTracks,
  getPublicTrackById,
  deletePublicTrack,
  getTopByPlays,
  getTopByLikes,
  addComplaint,
  getTracksByTags,
} = require("../controllers/publicLibraryController");

//Добавить трек в библиотеку
router.post("/", addPublicTrack);
//Все треки из библиотеки
router.get("/", getAllPublicTracks);
//Топ по прослушиваниям
router.get("/top-plays", getTopByPlays);
//Топ по лайкам
router.get("/top-likes", getTopByLikes);
//Получение трека по id
router.get("/:trackId", getPublicTrackById);
//Удаление трека по id
router.delete("/:trackId", deletePublicTrack);
//Отправка жалобы
router.post("/complaints", addComplaint);
//Получение по тэгам
router.post("/tags", express.json(), getTracksByTags);
module.exports = router;
