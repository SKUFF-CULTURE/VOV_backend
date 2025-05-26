const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const db = require("./db");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || null;
        const name = profile.displayName || null;
        const avatar = profile.photos?.[0]?.value || null;

        const { rows } = await db.query(
          "SELECT * FROM public.users WHERE google_id = $1 OR email = $2",
          [googleId, email]
        );

        let user;
        if (rows.length) {
          user = rows[0];

          // Обновляем google_id и avatar_url, если они отсутствуют или изменились
          const updates = [];
          const params = [];
          if (user.google_id !== googleId) {
            updates.push(`google_id = $${params.length + 1}`);
            params.push(googleId);
          }
          if (user.avatar_url !== avatar) {
            updates.push(`avatar_url = $${params.length + 1}`);
            params.push(avatar);
          }
          if (updates.length) {
            params.push(user.id);
            await db.query(
              `UPDATE public.users SET ${updates.join(", ")} WHERE id = $${
                params.length
              }`,
              params
            );
          }
        } else {
          // Создаём нового пользователя
          const insert = await db.query(
            `INSERT INTO public.users
           (name, email, google_id, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
            [name, email, googleId, avatar]
          );
          user = insert.rows[0];
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM public.users WHERE id = $1",
      [id]
    );
    done(null, rows[0] || false);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
