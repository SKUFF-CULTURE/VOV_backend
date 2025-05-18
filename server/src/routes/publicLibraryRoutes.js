const express = require('express');
const router = express.Router();
const {
  addPublicTrack,
  getAllPublicTracks,
  getPublicTrackById,
  deletePublicTrack,
  getTopByPlays,
  getTopByLikes
} = require('../controllers/publicLibraryController');

router.post('/', addPublicTrack);
router.get('/', getAllPublicTracks);
router.get('/top-plays', getTopByPlays);
router.get('/top-likes', getTopByLikes);
router.get('/:trackId', getPublicTrackById);
router.delete('/:trackId', deletePublicTrack);
module.exports = router;

