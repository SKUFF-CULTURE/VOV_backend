-- === 1. Расширение для UUID ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === 2. Таблица пользователей ===
CREATE TABLE IF NOT EXISTS public.users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),
  email      VARCHAR(100) UNIQUE,
  google_id  VARCHAR(255)
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
