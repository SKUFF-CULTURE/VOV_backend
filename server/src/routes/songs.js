// ----------------------------------------------
// src/routes/songs.js
// API-маршрут для добавления и получения треков

const express = require('express');
const router = express.Router();

// Вставка или обновление одного трека посредством JSON в теле запроса
router.post('/songs', async (req, res) => {
  const {
    path: filePath,
    format,
    title,
    artist,
    album,
    genre,
    track_number,
    date,
    duration
  } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Missing `path` field' });
  }

  try {
    const query = `
      INSERT INTO songs (path, format, title, artist, album, genre, track_number, date, duration)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (path) DO UPDATE SET
        format      = EXCLUDED.format,
        title       = EXCLUDED.title,
        artist      = EXCLUDED.artist,
        album       = EXCLUDED.album,
        genre       = EXCLUDED.genre,
        track_number= EXCLUDED.track_number,
        date        = EXCLUDED.date,
        duration    = EXCLUDED.duration
      RETURNING *;
    `;
    const values = [filePath, format, title, artist, album, genre, track_number, date, duration];
    const { rows } = await db.query(query, values);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error inserting track:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получение списка всех треков
router.get('/songs', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM songs ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching songs:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
