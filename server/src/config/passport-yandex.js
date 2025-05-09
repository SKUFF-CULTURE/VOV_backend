const passport = require('passport');
const { Strategy: YandexStrategy } = require('passport-yandex');
const db = require('./db');

passport.use(new YandexStrategy({
  clientID:     process.env.YANDEX_CLIENT_ID,
  clientSecret: process.env.YANDEX_CLIENT_SECRET,
  callbackURL:  process.env.YANDEX_CALLBACK_URL || 'http://localhost:5000/auth/yandex/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const yandexId = profile.id;
    const email    = profile.emails?.[0]?.value || null;

    // Собираем имя, если есть first_name/last_name или username
    const json      = profile._json || {};
    const display   = profile.displayName;
    const nameParts = [
      json.first_name && json.first_name.trim(),
      json.last_name  && json.last_name.trim()
    ].filter(Boolean);
    const name = display || nameParts.join(' ') || profile.username || null;

    // URL аватарки через default_avatar_id
    const avatar = json.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${json.default_avatar_id}/islands-200`
      : null;

    const { rows } = await db.query(
      'SELECT * FROM public.users WHERE google_id = $1 OR email = $2',
      [yandexId, email]
    );

    let user;
    if (rows.length) {
      user = rows[0];

      // Обновляем yandexId (храним его в google_id) и avatar_url
      const updates = [];
      const params  = [];
      if (user.google_id !== yandexId) {
        updates.push(`google_id = $${params.length + 1}`);
        params.push(yandexId);
      }
      if (user.avatar_url !== avatar) {
        updates.push(`avatar_url = $${params.length + 1}`);
        params.push(avatar);
      }
      if (updates.length) {
        params.push(user.id);
        await db.query(
          `UPDATE public.users SET ${updates.join(', ')} WHERE id = $${params.length}`,
          params
        );
      }
    } else {
      // Новый пользователь
      const insert = await db.query(
        `INSERT INTO public.users
           (name, email, google_id, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, email, yandexId, avatar]
      );
      user = insert.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM public.users WHERE id = $1',
      [id]
    );
    done(null, rows[0] || false);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
