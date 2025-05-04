// src/config/passport.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db'); // Наш модуль для работы с PostgreSQL

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, // задайте в .env
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, // задайте в .env
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      // Получаем уникальный идентификатор и email пользователя от Google
      const googleId = profile.id;
      const email = profile.emails && profile.emails[0].value;
      // Ищем пользователя по google_id или email
      const result = await db.query(
        'SELECT * FROM public.users WHERE google_id = $1 OR email = $2',
        [googleId, email]
      );
      
      let user;
      if(result.rows.length > 0) {
         // Если пользователь найден – обновляем google_id, если его ещё нет
         user = result.rows[0];
         if(!user.google_id) {
           await db.query(
             'UPDATE users SET google_id = $1 WHERE id = $2',
             [googleId, user.id]
           );
         }
      } else {
         // Если пользователя нет, создаем нового (в данном примере роль по умолчанию "student")
         const newUserResult = await db.query(
           'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3, $4) RETURNING *',
           [profile.displayName, email, 'student', googleId]
         );
         user = newUserResult.rows[0];
      }
      return done(null, user);
    } catch (err) {
      console.error('Error in Google Strategy:', err);
      return done(err, null);
    }
  }
));

// Сериализация пользователя в сессию
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Десериализация – поиск пользователя по id в базе данных
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if(result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(null, false);
    }
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
