const passport = require('passport');
const { Strategy: YandexStrategy } = require('passport-yandex');
const db = require('./db');

passport.use(new YandexStrategy({
  clientID:     process.env.YANDEX_CLIENT_ID,
  clientSecret: process.env.YANDEX_CLIENT_SECRET,
  callbackURL:  process.env.YANDEX_CALLBACK_URL || 'http://localhost:5000/auth/yandex/callback'
}, async (accessToken, refreshToken, profile, done) => {
  const yandexId = profile.id;
  // Яндекс выдаёт email, если попросить scope 'login:email'
  const email = profile.emails?.[0]?.value;

  try {
    // Ищем пользователя по yandex_id или email
    const { rows } = await db.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [yandexId, email]
    );

    let user;
    if (rows.length) {
      user = rows[0];
      // Если раньше входили по email, обновляем yandex_id
      if (!user.google_id) {
        await db.query(
          'UPDATE users SET google_id = $1 WHERE id = $2',
          [yandexId, user.id]
        );
      }
    } else {
      // Создаём нового пользователя
      const res = await db.query(
        'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *',
        [profile.displayName, email, yandexId]
      );
      user = res.rows[0];
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
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0] || false);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
