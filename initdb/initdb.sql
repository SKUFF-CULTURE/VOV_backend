CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  google_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.songs (
  id           SERIAL PRIMARY KEY,
  path         TEXT    UNIQUE       NOT NULL,   -- полный путь к файлу
  format       TEXT                  NULL,      -- расширение (mp3, flac и т.д.)
  title        TEXT                  NULL,
  artist       TEXT                  NULL,
  album        TEXT                  NULL,
  genre        TEXT                  NULL,
  track_number TEXT                  NULL,
  date         TEXT                  NULL,
  duration     INTEGER               NULL       -- длительность в секундах
);
