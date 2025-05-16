-- === Существующие таблицы ===

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

-- === Добавляем UUID-расширение для генерации uuid_generate_v4() ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === Таблица для хранений задач реставрации ===
CREATE TABLE IF NOT EXISTS public.restorations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     INTEGER     NOT NULL,
  file_path   TEXT        NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_restoration_user
    FOREIGN KEY(user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE
);

-- === Функция и триггер для автоматического обновления updated_at ===
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
