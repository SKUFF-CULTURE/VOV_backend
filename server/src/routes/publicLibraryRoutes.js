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
  getTracksByTags
} = require("../controllers/publicLibraryController");

router.post("/", addPublicTrack);
router.get("/", getAllPublicTracks);
router.get("/top-plays", getTopByPlays);
router.get("/top-likes", getTopByLikes);
router.get("/:trackId", getPublicTrackById);
router.delete("/:trackId", deletePublicTrack);
router.post("/complaints", addComplaint);
router.post("/tags", express.json(), getTracksByTags);
module.exports = router;
