const db = require("../config/db");
const {
  getCached,
  invalidateCache,
  invalidateCacheByPrefix,
} = require("../utils/RedisCache");

exports.addToLibrary = async (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) {
    return res.status(400).json({ error: "userId и trackId обязательны" });
  }
  try {
    const user = await db.query("SELECT 1 FROM public.users WHERE id = $1", [userId]);
    if (user.rowCount === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    const track = await db.query(
      "SELECT 1 FROM public.restorations WHERE id = $1",
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: "Трек не найден" });
    }
    const insertUserLib = await db.query(
      `INSERT INTO public.user_library (user_id, track_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING track_id`,
      [userId, trackId]
    );
    if (insertUserLib.rowCount > 0) {
      const upsertLike = await db.query(
        `INSERT INTO public.public_library (track_id, likes, play_count)
         VALUES ($1, 1, 0)
         ON CONFLICT (track_id) DO
           UPDATE SET likes = public.public_library.likes + 1
         RETURNING likes`,
        [trackId]
      );
      await Promise.all([
        invalidateCache(`userLibrary:${userId}`),
        invalidateCache(`publicTrack:${trackId}`),
        invalidateCacheByPrefix("publicTracks:"),
        invalidateCacheByPrefix("topByPlays:"),
        invalidateCacheByPrefix("topByLikes:"),
      ]);
      return res.status(201).json({
        userId,
        trackId,
        likes: upsertLike.rows[0].likes,
      });
    }
    return res.status(200).json({ userId, trackId, message: "Уже в библиотеке" });
  } catch (err) {
    console.error("Ошибка addToLibrary:", err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

exports.getLibrary = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId обязателен" });
  }
  const cacheKey = `userLibrary:${userId}`;
  try {
    const result = await getCached(
      cacheKey,
      async () => {
        const user = await db.query(
          "SELECT 1 FROM public.users WHERE id = $1",
          [userId]
        );
        if (user.rowCount === 0) {
          return { error: "Пользователь не найден", status: 404 };
        }
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
              m.tags,
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
        return { tracks: rows };
      },
      300
    );
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("Ошибка getLibrary:", err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

exports.removeFromLibrary = async (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) {
    return res.status(400).json({ error: "userId и trackId обязательны" });
  }
  try {
    const user = await db.query("SELECT 1 FROM public.users WHERE id = $1", [userId]);
    if (user.rowCount === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    const track = await db.query(
      "SELECT 1 FROM public.restorations WHERE id = $1",
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: "Трек не найден" });
    }
    const deleteResult = await db.query(
      `DELETE FROM public.user_library
       WHERE user_id = $1 AND track_id = $2
       RETURNING track_id`,
      [userId, trackId]
    );
    if (deleteResult.rowCount > 0) {
      const updateLikes = await db.query(
        `UPDATE public.public_library
         SET likes = GREATEST(likes - 1, 0)
         WHERE track_id = $1
         RETURNING likes`,
        [trackId]
      );
      await Promise.all([
        invalidateCache(`userLibrary:${userId}`),
        invalidateCache(`publicTrack:${trackId}`),
        invalidateCacheByPrefix("publicTracks:"),
        invalidateCacheByPrefix("topByPlays:"),
        invalidateCacheByPrefix("topByLikes:"),
      ]);
      return res.status(200).json({
        userId,
        trackId,
        likes: updateLikes.rows[0].likes,
      });
    }
    return res.status(200).json({
      userId,
      trackId,
      message: "Трек не был в библиотеке",
    });
  } catch (err) {
    console.error("Ошибка removeFromLibrary:", err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

exports.getTracksByTags = async (req, res) => {
  let { userId, tags } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId обязателен" });
  }

  // Если tags не передан, ищем все треки пользователя
  let tagFilter = [];
  if (tags) {
    tagFilter = Array.isArray(tags) ? tags : [tags]; // Преобразуем строку в массив
    if (tagFilter.some(tag => typeof tag !== 'string' || tag.trim() === '')) {
      return res.status(400).json({ error: "tags должен содержать непустые строки" });
    }
  }

  try {
    const user = await db.query(
      "SELECT 1 FROM public.users WHERE id = $1",
      [userId]
    );
    if (user.rowCount === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    let query = `
      SELECT
          r.id AS trackId,
          r.file_path_original AS originalPath,
          r.file_path_processed AS processedPath,
          r.status AS status,
          ul.added_at AS addedAt,
          m.title AS title,
          m.author AS author,
          m.year AS year,
          m.album AS album,
          m.country AS country,
          m.cover_url AS coverUrl,
          m.tags,
          COALESCE(pl.likes, 0) AS likes,
          COALESCE(pl.play_count, 0) AS playCount
       FROM public.user_library ul
       JOIN public.restorations r ON r.id = ul.track_id
       LEFT JOIN public.restoration_metadata m ON r.id = m.restoration_id
       LEFT JOIN public.public_library pl ON r.id = pl.track_id
       WHERE ul.user_id = $1
    `;
    const params = [userId];

    if (tagFilter.length > 0) {
      query += ` AND (`;
      tagFilter.forEach((tag, index) => {
        if (index > 0) query += ` OR `;
        query += `m.tags LIKE $${params.length + 1}`;
        params.push(`%${tag}%`);
      });
      query += `)`;
    }

    query += ` ORDER BY ul.added_at DESC`;
    const { rows } = await db.query(query, params);
    return res.status(200).json({ tracks: rows });
  } catch (err) {
    console.error(`Ошибка getTracksByTags [userId=${userId}]:`, err);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};