const db = require('../config/db');
const { getCached, invalidateCache, invalidateCacheByPrefix } = require('../utils/RedisCache');

exports.addPublicTrack = async (req, res) => {
  const { trackId } = req.body;
  if (!trackId) return res.status(400).json({ error: 'trackId обязателен' });
  try {
    const track = await db.query(
      'SELECT 1 FROM public.restoration_metadata WHERE restoration_id = $1',
      [trackId]
    );
    if (track.rowCount === 0) return res.status(404).json({ error: 'Метаданные для трека не найдены' });
    await db.query(
      `INSERT INTO public.public_library (track_id)
       VALUES ($1) ON CONFLICT DO NOTHING`,
      [trackId]
    );
    // Invalidate caches affected by adding a new track
    await Promise.all([
      invalidateCache(`publicTrack:${trackId}`),
      invalidateCacheByPrefix('publicTracks:'),
      invalidateCacheByPrefix('topByPlays:'),
      invalidateCacheByPrefix('topByLikes:')
    ]);
    return res.status(201).json({ trackId });
  } catch (err) {
    console.error('Ошибка addPublicTrack:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};
const db = require('../config/db');
const { invalidateCache, invalidateCacheByPrefix } = require('../utils/RedisCache');

exports.addComplaint = async (req, res) => {
  const { trackId } = req.body;
  const clientIp = req.ip; // Получаем IP-адрес клиента

  // Проверяем, что trackId передан
  if (!trackId) {
    return res.status(400).json({ error: 'trackId обязателен' });
  }

  try {
    // Проверяем, не отправлял ли клиент с этого IP жалобу на этот трек
    const existingComplaint = await db.query(
      'SELECT 1 FROM public.complaints WHERE client_ip = $1 AND track_id = $2',
      [clientIp, trackId]
    );
    if (existingComplaint.rowCount > 0) {
      return res.status(400).json({ error: 'Жалоба с этого IP уже отправлена на этот трек' });
    }

    // Проверяем существование трека
    const track = await db.query(
      'SELECT id, complaint_count FROM public.restorations WHERE id = $1',
      [trackId]
    );
    if (track.rowCount === 0) {
      return res.status(404).json({ error: 'Трек не найден' });
    }

    // Добавляем запись о жалобе в таблицу complaints
    await db.query(
      'INSERT INTO public.complaints (client_ip, track_id) VALUES ($1, $2)',
      [clientIp, trackId]
    );

    // Увеличиваем счётчик жалоб в таблице restorations
    const updatedTrack = await db.query(
      `UPDATE public.restorations 
       SET complaint_count = complaint_count + 1 
       WHERE id = $1 
       RETURNING complaint_count`,
      [trackId]
    );

    const newComplaintCount = updatedTrack.rows[0].complaint_count;

    // Инвалидируем кэши, связанные с треком
    await Promise.all([
      invalidateCache(`publicTrack:${trackId}`),
      invalidateCacheByPrefix('publicTracks:'),
      invalidateCacheByPrefix('topByPlays:'),
      invalidateCacheByPrefix('topByLikes:')
    ]);

    // Логируем жалобу
    console.log(`Жалоба на трек ${trackId} зарегистрирована с IP ${clientIp}`);

    // Если счётчик достиг 10, трек уже удалён триггером
    if (newComplaintCount >= 10) {
      return res.status(200).json({ message: 'Трек удалён из-за превышения лимита жалоб' });
    }

    return res.status(200).json({ 
      trackId, 
      complaintCount: newComplaintCount,
      message: 'Жалоба зарегистрирована' 
    });
  } catch (err) {
    console.error('Ошибка addComplaint:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.getAllPublicTracks = async (req, res) => {
  const cacheKey = 'publicTracks:all';
  try {
    const tracks = await getCached(cacheKey, async () => {
      const { rows } = await db.query(
        `SELECT l.track_id AS trackId,
                m.title,
                m.author,
                m.year,
                m.album,
                m.country,
                m.cover_url AS coverUrl,
                l.likes AS likes,
                l.play_count AS playCount
         FROM public.public_library AS l
         JOIN public.restoration_metadata AS m
           ON l.track_id = m.restoration_id
         ORDER BY m.title NULLS LAST`
      );
      return { tracks: rows };
    }, 300); // 5 minutes TTL
    return res.status(200).json(tracks);
  } catch (err) {
    console.error('Ошибка getAllPublicTracks:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.getPublicTrackById = async (req, res) => {
  const { trackId } = req.params;
  const cacheKey = `publicTrack:${trackId}`;
  try {
    const track = await getCached(cacheKey, async () => {
      const { rows } = await db.query(
        `SELECT l.track_id AS trackId,
                m.title,
                m.author,
                m.year,
                m.album,
                m.country,
                m.cover_url AS coverUrl,
                l.likes AS likes,
                l.play_count AS playCount
         FROM public.public_library AS l
         JOIN public.restoration_metadata AS m
           ON l.track_id = m.restoration_id
         WHERE l.track_id = $1`,
        [trackId]
      );
      if (rows.length === 0) return null;
      return rows[0];
    }, 300); // 5 minutes TTL
    if (!track) return res.status(404).json({ error: 'Трек не найден в публичном пуле' });
    return res.status(200).json(track);
  } catch (err) {
    console.error(`Ошибка getPublicTrackById ${trackId}:`, err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.getTopByPlays = async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const cacheKey = `topByPlays:${limit}`;
  try {
    const tracks = await getCached(cacheKey, async () => {
      const { rows } = await db.query(
        `SELECT l.track_id AS trackId,
                m.title,
                m.author,
                m.year,
                m.album,
                m.country,
                m.cover_url AS coverUrl,
                l.likes AS likes,
                l.play_count AS playCount
         FROM public.public_library AS l
         JOIN public.restoration_metadata AS m
           ON l.track_id = m.restoration_id
         ORDER BY l.play_count DESC
         LIMIT $1`,
        [limit]
      );
      return { tracks: rows };
    }, 300); // 5 minutes TTL
    return res.status(200).json(tracks);
  } catch (err) {
    console.error('Ошибка getTopByPlays:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.getTopByLikes = async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const cacheKey = `topByLikes:${limit}`;
  try {
    const tracks = await getCached(cacheKey, async () => {
      const { rows } = await db.query(
        `SELECT l.track_id AS trackId,
                m.title,
                m.author,
                m.year,
                m.album,
                m.country,
                m.cover_url AS coverUrl,
                l.likes AS likes,
                l.play_count AS playCount
         FROM public.public_library AS l
         JOIN public.restoration_metadata AS m
           ON l.track_id = m.restoration_id
         ORDER BY l.likes DESC
         LIMIT $1`,
        [limit]
      );
      return { tracks: rows };
    }, 300); // 5 minutes TTL
    return res.status(200).json(tracks);
  } catch (err) {
    console.error('Ошибка getTopByLikes:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

exports.deletePublicTrack = async (req, res) => {
  const { trackId } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM public.public_library WHERE track_id = $1',
      [trackId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Трек не найден в публичном пуле' });
    // Invalidate caches affected by deleting a track
    await Promise.all([
      invalidateCache(`publicTrack:${trackId}`),
      invalidateCacheByPrefix('publicTracks:'),
      invalidateCacheByPrefix('topByPlays:'),
      invalidateCacheByPrefix('topByLikes:')
    ]);
    return res.status(204).send();
  } catch (err) {
    console.error(`Ошибка deletePublicTrack ${trackId}:`, err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};