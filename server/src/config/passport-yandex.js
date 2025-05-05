// src/config/passport-yandex.js
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

    // Формируем имя: приоритет — displayName, потом first_name+last_name, потом username
    const name = profile.displayName
      || `${(profile._json.first_name || '').trim()} ${(profile._json.last_name || '').trim()}`.trim()
      || profile.username
      || null;

    // Ищем по внешнему ID (yandexId) или email
    const { rows } = await db.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [yandexId, email]
    );

    let user;
    if (rows.length) {
      user = rows[0];

      // Если пользователь ранее заходил только по email — сохраняем yandexId
      if (!user.google_id) {
        await db.query(
          'UPDATE users SET google_id = $1 WHERE id = $2',
          [yandexId, user.id]
        );
      }

      // Если имя изменилось — обновляем
      if (user.name !== name) {
        await db.query(
          'UPDATE users SET name = $1 WHERE id = $2',
          [name, user.id]
        );
      }
    } else {
      // Новый пользователь — вставляем сразу имя, email и yandexId
      const insertRes = await db.query(
        'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *',
        [name, email, yandexId]
      );
      user = insertRes.rows[0];
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    done(null, rows[0] || false);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
