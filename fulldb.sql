-- Включение расширения uuid-ossp (если ещё не включено)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Вставка пользователей
INSERT INTO public.users (name, email, google_id, avatar_url)
VALUES
  ('Alice', 'alice@example.com', 'google_123', 'http://example.com/avatars/alice.jpg'),
  ('Bob', 'bob@example.com', 'google_456', 'http://example.com/avatars/bob.jpg')
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Вставка треков
INSERT INTO public.restorations (id, user_id, file_path_original, file_path_processed, status, created_at, updated_at)
SELECT public.uuid_generate_v4(), id, '/uploads/track1_original.mp3', '/processed/alice/track1_processed.mp3', 'processed', NOW(), NOW()
FROM public.users WHERE email = 'alice@example.com'
UNION
SELECT public.uuid_generate_v4(), id, '/uploads/track2_original.mp3', '/processed/bob/track2_processed.mp3', 'processed', NOW(), NOW()
FROM public.users WHERE email = 'bob@example.com'
RETURNING id;

-- Вставка метаданных с lyrics и tags
INSERT INTO public.restoration_metadata (restoration_id, title, author, album, year, country, cover_url, lyrics, tags, created_at, updated_at)
SELECT id, 'Пули свистят', 'Народная', 'Степь', '1941', 'USSR', 'http://example.com/covers/step.jpg',
       '[
         {"start": "0:00:30", "end": "0:00:35", "text": "Только пули свистят по степи."},
         {"start": "0:00:36", "end": "0:00:40", "text": "Только ветер уйди в провода,"},
         {"start": "0:00:42", "end": "0:00:44", "text": "Тускла звезды мерцают."},
         {"start": "0:00:48", "end": "0:00:52", "text": "Чемную нон, ты, люди,"},
         {"start": "0:00:52", "end": "0:00:55", "text": "Моя знаю птик."},
         {"start": "0:00:56", "end": "0:01:00", "text": "И у детской кровати тайком"},
         {"start": "0:01:01", "end": "0:01:04", "text": "Ты влезу втираешь."},
         {"start": "0:01:07", "end": "0:01:09", "text": "Как я люблю"},
         {"start": "0:01:10", "end": "0:01:14", "text": "Убину твои хвастовые глаз."},
         {"start": "0:01:16", "end": "0:01:18", "text": "Как я хочу"},
         {"start": "0:01:19", "end": "0:01:22", "text": "К ним прижаться сейчас"},
         {"start": "0:01:25", "end": "0:01:28", "text": "Убанить тёмное,"},
         {"start": "0:01:28", "end": "0:01:34", "text": "Но разделянец любимая она."},
         {"start": "0:01:35", "end": "0:01:39", "text": "И тревоженная чёрная стель"},
         {"start": "0:01:39", "end": "0:01:43", "text": "Пролегла между нами."},
         {"start": "0:01:47", "end": "0:01:50", "text": "Верю в тебя,"},
         {"start": "0:01:51", "end": "0:01:55", "text": "Дорогую подругу мою."},
         {"start": "0:01:56", "end": "0:02:00", "text": "Это зера от пули меня"},
         {"start": "0:02:00", "end": "0:02:03", "text": "Тёмной ночью хранила."},
         {"start": "0:02:07", "end": "0:02:10", "text": "Рада на мне,"},
         {"start": "0:02:10", "end": "0:02:15", "text": "Я спокоен смертельно в бою."},
         {"start": "0:02:15", "end": "0:02:19", "text": "Занаю встретишь с любовью меня,"},
         {"start": "0:02:21", "end": "0:02:24", "text": "Чтоб со мной не случилось."},
         {"start": "0:02:28", "end": "0:02:30", "text": "Смерть не страшена,"},
         {"start": "0:02:31", "end": "0:02:35", "text": "С ней встречались не раз мы в степи."},
         {"start": "0:02:37", "end": "0:02:38", "text": "Вот и теперь"},
         {"start": "0:02:39", "end": "0:02:45", "text": "Надо мною она сружится."},
         {"start": "0:02:47", "end": "0:02:50", "text": "Ты меня ждёшь"},
         {"start": "0:02:50", "end": "0:02:54", "text": "И у детской кровати не спишь."},
         {"start": "0:02:55", "end": "0:02:59", "text": "И поэтому зная со мной"},
         {"start": "0:02:59", "end": "0:03:03", "text": "Ничего не случится."}
       ]'::jsonb,
       'war,folk,love',
       NOW(), NOW()
FROM public.restorations WHERE file_path_original = '/uploads/track1_original.mp3'
UNION
SELECT id, 'Song Two', 'Artist Two', 'Album Two', '2024', 'UK', 'http://example.com/covers/song2.jpg',
       '[{"start": "0:00:00", "end": "0:00:05", "text": "Другой пример lyrics"}]'::jsonb,
       'jazz,blues',
       NOW(), NOW()
FROM public.restorations WHERE file_path_original = '/uploads/track2_original.mp3';

-- Вставка в пользовательскую библиотеку
INSERT INTO public.user_library (user_id, track_id, added_at)
SELECT u.id, r.id, NOW()
FROM public.users u
JOIN public.restorations r ON u.id = r.user_id
WHERE u.email = 'alice@example.com' AND r.file_path_original = '/uploads/track1_original.mp3'
UNION
SELECT u.id, r.id, NOW()
FROM public.users u
JOIN public.restorations r ON u.id = r.user_id
WHERE u.email = 'bob@example.com' AND r.file_path_original = '/uploads/track2_original.mp3';

-- Вставка в публичную библиотеку
INSERT INTO public.public_library (track_id, likes, play_count)
SELECT id, 10, 100 FROM public.restorations WHERE file_path_original = '/uploads/track1_original.mp3'
UNION
SELECT id, 5, 50 FROM public.restorations WHERE file_path_original = '/uploads/track2_original.mp3';