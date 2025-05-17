// controllers/userLibraryController.js
const dg = require('../config/db');

exports.addToLibrary = async (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) {
    return res.status(400).json({ error: 'userId и trackId обязательны' });
  }

  try {
    // проверка существования пользователя
    const user = await dg.query(
      'SELECT 1 FROM public.users WHERE id = $1',
      [userId]
    );
    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // проверка существования трека
    const track = await dg.query(
      'SELECT 1 FROM public.restorations WHERE id = $1',
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    // вставка (игнорируем дубли)
    await dg.query(
      `INSERT INTO public.user_library (user_id, track_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, trackId]
    );

    return res.status(201).json({ userId, trackId });
  } catch (err) {
    console.error('Ошибка addToLibrary:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.getLibrary = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId обязателен' });
  }

  try {
    // проверка существования пользователя
    const user = await dg.query(
      'SELECT 1 FROM public.users WHERE id = $1',
      [userId]
    );
    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // получаем все треки из библиотеки
    const { rows } = await dg.query(
      `SELECT
         r.id                   AS trackId,
         r.file_path_original   AS originalPath,
         r.file_path_processed  AS processedPath,
         r.status,
         ul.added_at            AS addedAt
       FROM public.user_library ul
       JOIN public.restorations r
         ON r.id = ul.track_id
       WHERE ul.user_id = $1
       ORDER BY ul.added_at DESC`,
      [userId]
    );

    return res.status(200).json({ tracks: rows });
  } catch (err) {
    console.error('Ошибка getLibrary:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
