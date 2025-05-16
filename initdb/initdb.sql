-- === Добавляем UUID-расширение для генерации uuid_generate_v4() ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === Существующие таблицы ===

CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  google_id VARCHAR(255)
);

ALTER TABLE public.users
  ADD COLUMN avatar_url TEXT;


-- Таблица restorations
CREATE TABLE IF NOT EXISTS public.restorations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     INTEGER     NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  file_path_original   TEXT        NOT NULL,
  file_path_processed TEXT         NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Функция и триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.restorations;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.restorations
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_set_updated_at();

-- === Новая таблица для метаданных ===
CREATE TABLE IF NOT EXISTS public.restoration_metadata (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  restoration_id  UUID        NOT NULL
    REFERENCES public.restorations(id) ON DELETE CASCADE,
  title           TEXT        NULL,
  author          TEXT        NULL,
  year            VARCHAR(4)  NULL,
  album           TEXT        NULL,
  cover_url       TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Триггер для updated_at в metadata
DROP TRIGGER IF EXISTS set_updated_at ON public.restoration_metadata;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.restoration_metadata
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_set_updated_at();
