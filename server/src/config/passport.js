// src/config/passport.js

const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const db = require('./db');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value;

  try {
    // Ищем по google_id или email
    const { rows } = await db.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    let user;
    if (rows.length) {
      user = rows[0];
      // Обновляем google_id, если раньше входили по email
      if (!user.google_id) {
        await db.query(
          'UPDATE users SET google_id = $1 WHERE id = $2',
          [googleId, user.id]
        );
      }
    } else {
      // Создаем нового пользователя
      const res = await db.query(
        'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *',
        [profile.displayName, email, googleId]
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
