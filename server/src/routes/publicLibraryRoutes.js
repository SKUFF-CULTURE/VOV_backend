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
module.exports = router;

