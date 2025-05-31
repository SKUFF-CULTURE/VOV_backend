-- === 1. Расширение для UUID ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === 2. Таблица пользователей ===
CREATE TABLE IF NOT EXISTS public.users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),
  email      VARCHAR(100) UNIQUE,
  google_id  VARCHAR(255),
  role       VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'banned'))
);
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  


-- === 3. Таблица restorations ===
CREATE TABLE IF NOT EXISTS public.restorations (
  id                   UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  user_id              INTEGER     NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  file_path_original   TEXT        NOT NULL,
  file_path_processed  TEXT        NULL,
  status               VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()

);
ALTER TABLE public.restorations
  ADD COLUMN IF NOT EXISTS complaint_count INTEGER NOT NULL DEFAULT 0;

-- Триггер на обновление complaint_count

DROP TABLE IF EXISTS public.complaints;
CREATE TABLE IF NOT EXISTS public.complaints (
  user_id    INTEGER    NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  track_id   UUID       NOT NULL
    REFERENCES public.restorations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, track_id)
);

-- Создаём функцию для автоматического удаления трека
CREATE OR REPLACE FUNCTION public.delete_track_on_complaint_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.complaint_count >= 10 THEN
    DELETE FROM public.restorations WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаём триггер
DROP TRIGGER IF EXISTS trg_delete_on_complaint_limit ON public.restorations;
CREATE TRIGGER trg_delete_on_complaint_limit
  AFTER UPDATE OF complaint_count ON public.restorations
  FOR EACH ROW
  WHEN (NEW.complaint_count >= 10)
  EXECUTE FUNCTION public.delete_track_on_complaint_limit();

-- === 4. Общая функция для updated_at-триггеров ===
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- === 5. Триггер на public.restorations ===
DROP TRIGGER IF EXISTS trg_restorations_updated_at ON public.restorations;
CREATE TRIGGER trg_restorations_updated_at
  BEFORE UPDATE ON public.restorations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- === 6. Таблица restoration_metadata ===
CREATE TABLE IF NOT EXISTS public.restoration_metadata (
  id              UUID        PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  restoration_id  UUID        NOT NULL
    REFERENCES public.restorations(id) ON DELETE CASCADE,
  title           TEXT        NULL,
  author          TEXT        NULL,
  year            VARCHAR(4)  NULL,
  album           TEXT        NULL,
  country         TEXT        NULL,
  cover_url       TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restoration_metadata
  ADD COLUMN IF NOT EXISTS lyrics TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT;          -- Для хранения тегов в формате JSON

-- === 7. Триггер на public.restoration_metadata ===
DROP TRIGGER IF EXISTS trg_metadata_updated_at ON public.restoration_metadata;
CREATE TRIGGER trg_metadata_updated_at
  BEFORE UPDATE ON public.restoration_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- === 8. Миграция: создаём таблицу «личной библиотеки» пользователей ===
CREATE TABLE IF NOT EXISTS public.user_library (
  user_id   INTEGER    NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  track_id  UUID       NOT NULL
    REFERENCES public.restorations(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
-- 9. Создаём таблицу public_library
CREATE TABLE IF NOT EXISTS public.public_library (
  -- track_id — то же, что и restoration.id
  track_id UUID PRIMARY KEY
    REFERENCES public.restorations(id) ON DELETE CASCADE
);

-- Создаём VIEW для удобного получения метаданных вместе с записью из public_library
CREATE OR REPLACE VIEW public.public_library_with_metadata AS
SELECT
  l.track_id,
  m.title,
  m.author,
  m.year,
  m.album,
  m.country,
  m.cover_url
FROM
  public.public_library AS l
  JOIN public.restoration_metadata AS m
    ON l.track_id = m.restoration_id;

ALTER TABLE public.public_library
  ADD COLUMN IF NOT EXISTS likes       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_count  INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_restorations_user_id ON public.restorations(user_id);
CREATE INDEX idx_user_library_user_id ON public.user_library(user_id);
CREATE INDEX idx_user_library_track_id ON public.user_library(track_id);