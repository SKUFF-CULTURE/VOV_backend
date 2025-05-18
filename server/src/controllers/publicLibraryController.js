// controllers/publicLibraryController.js
const db = require('../config/db');

// Добавить трек в публичный пул
exports.addPublicTrack = async (req, res) => {
  const { trackId } = req.body;
  if (!trackId) {
    return res.status(400).json({ error: 'trackId обязателен' });
  }

  try {
    // проверка существования трека в метаданных
    const track = await db.query(
      'SELECT 1 FROM public.restoration_metadata WHERE restoration_id = $1',
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: 'Метаданные для трека не найдены' });
    }

    // вставляем трек (игнорируем дубли)
    await db.query(
      `INSERT INTO public.public_library (track_id)
       VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [trackId]
    );

    return res.status(201).json({ trackId });
  } catch (err) {
    console.error('Ошибка addPublicTrack:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Получить весь публичный пул с метаданными
exports.getAllPublicTracks = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         l.track_id    AS trackId,
         m.title,
         m.author,
         m.year,
         m.album,
         m.country,
         m.cover_url   AS coverUrl,
         l.likes       AS likes,
         l.play_count  AS playCount
       FROM public.public_library AS l
       JOIN public.restoration_metadata AS m
         ON l.track_id = m.restoration_id
       ORDER BY m.title NULLS LAST`
    );
    return res.status(200).json({ tracks: rows });
  } catch (err) {
    console.error('Ошибка getAllPublicTracks:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Получить один трек по trackId
exports.getPublicTrackById = async (req, res) => {
  const { trackId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT
         l.track_id    AS trackId,
         m.title,
         m.author,
         m.year,
         m.album,
         m.country,
         m.cover_url   AS coverUrl,
         l.likes       AS likes,
         l.play_count  AS playCount
       FROM public.public_library AS l
       JOIN public.restoration_metadata AS m
         ON l.track_id = m.restoration_id
       WHERE l.track_id = $1`,
      [trackId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Трек не найден в публичном пуле' });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error(`Ошибка getPublicTrackById ${trackId}:`, err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Удалить трек из публичного пула
exports.deletePublicTrack = async (req, res) => {
  const { trackId } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM public.public_library WHERE track_id = $1',
      [trackId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Трек не найден в публичном пуле' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error(`Ошибка deletePublicTrack ${trackId}:`, err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
