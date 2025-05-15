CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  google_id VARCHAR(255)
);

ALTER TABLE public.users
  ADD COLUMN avatar_url TEXT;

CREATE TABLE IF NOT EXISTS public.songs (
  id             SERIAL PRIMARY KEY,
  path           TEXT    UNIQUE       NOT NULL,
  file_format    TEXT                  NULL,
  title          TEXT                  NULL,
  artist         TEXT                  NULL,
  album          TEXT                  NULL,
  genre          TEXT                  NULL,
  track_number   TEXT                  NULL,
  release_date   TEXT                  NULL,
  duration       INTEGER               NULL
);
