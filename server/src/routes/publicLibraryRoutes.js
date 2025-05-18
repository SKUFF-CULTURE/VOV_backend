const express = require('express');
const router = express.Router();
const {
  addPublicTrack,
  getAllPublicTracks,
  getPublicTrackById,
  deletePublicTrack
} = require('../controllers/publicLibraryController');

router.post('/', addPublicTrack);
router.get('/', getAllPublicTracks);
router.get('/:trackId', getPublicTrackById);
router.delete('/:trackId', deletePublicTrack);
router.get('/top-plays', getTopByPlays);
router.get('/top-likes', getTopByLikes);
module.exports = router;

