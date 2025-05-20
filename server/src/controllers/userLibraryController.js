// controllers/userLibraryController.js
const db = require('../config/db');

exports.addToLibrary = async (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) {
    return res.status(400).json({ error: 'userId и trackId обязательны' });
  }

  try {
    // проверка существования пользователя
    const user = await db.query(
      'SELECT 1 FROM public.users WHERE id = $1',
      [userId]
    );
    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // проверка существования трека
    const track = await db.query(
      'SELECT 1 FROM public.restorations WHERE id = $1',
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    // Вставка в user_library (игнорируем дубли)
    const insertUserLib = await db.query(
      `INSERT INTO public.user_library (user_id, track_id)
         VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING track_id`,
      [userId, trackId]
    )

    // Если это первый раз — увеличиваем лайк (UPSERT в public_library)
    if (insertUserLib.rowCount > 0) {
      const upsertLike = await db.query(
        `INSERT INTO public.public_library (track_id, likes, play_count)
           VALUES ($1, 1, 0)
         ON CONFLICT (track_id) DO
           UPDATE SET likes = public.public_library.likes + 1
         RETURNING likes`,
        [trackId]
      );

      return res.status(201).json({
        userId,
        trackId,
        likes: upsertLike.rows[0].likes
      });
    }

    // Уже в user_library — ничего не делаем с лайками
    return res.status(200).json({ userId, trackId, message: 'Уже в библиотеке' });
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
    const user = await db.query(
      'SELECT 1 FROM public.users WHERE id = $1',
      [userId]
    );
    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // получаем все треки из библиотеки с метаданными
    const { rows } = await db.query(
    `SELECT
      r.id                     AS trackId,
      r.file_path_original     AS originalPath,
      r.file_path_processed    AS processedPath,
      r.status                 AS status,
      ul.added_at              AS addedAt,
      m.title                  AS title,
      m.author                 AS author,
      m.year                   AS year,
      m.album                  AS album,
      m.country                AS country,
      m.cover_url              AS coverUrl,
      COALESCE(pl.likes, 0)    AS likes,
      COALESCE(pl.play_count, 0) AS playCount
    FROM public.user_library ul
    JOIN public.restorations r
      ON r.id = ul.track_id
    LEFT JOIN public.restoration_metadata m
      ON r.id = m.restoration_id
    LEFT JOIN public.public_library pl
      ON r.id = pl.track_id
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
exports.removeFromLibrary = async (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) {
    return res.status(400).json({ error: 'userId и trackId обязательны' });
  }

  try {
    // проверка существования пользователя
    const user = await db.query(
      'SELECT 1 FROM public.users WHERE id = $1',
      [userId]
    );
    if (user.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // проверка существования трека
    const track = await db.query(
      'SELECT 1 FROM public.restorations WHERE id = $1',
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    // удаляем из user_library
    const deleteResult = await db.query(
      `DELETE FROM public.user_library
         WHERE user_id = $1 AND track_id = $2
       RETURNING track_id`,
      [userId, trackId]
    );

    if (deleteResult.rowCount > 0) {
      // уменьшаем лайки в public_library, но не ниже нуля
      const updateLikes = await db.query(
        `UPDATE public.public_library
            SET likes = GREATEST(likes - 1, 0)
          WHERE track_id = $1
          RETURNING likes`,
        [trackId]
      );

      return res.status(200).json({
        userId,
        trackId,
        likes: updateLikes.rows[0].likes
      });
    }

    // не было записи в user_library
    return res.status(200).json({
      userId,
      trackId,
      message: 'Трек не был в библиотеке'
    });
  } catch (err) {
    console.error('Ошибка removeFromLibrary:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};