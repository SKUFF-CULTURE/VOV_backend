-- server/init.sql
INSERT INTO public.users (name, email, google_id, avatar_url)
VALUES
  ('Alice', 'alice@example.com', 'google_123', 'http://example.com/avatars/alice.jpg'),
  ('Bob', 'bob@example.com', 'google_456', 'http://example.com/avatars/bob.jpg')
ON CONFLICT (email) DO NOTHING
RETURNING id;

INSERT INTO public.restorations (id, user_id, file_path_original, file_path_processed, status, created_at, updated_at)
SELECT public.uuid_generate_v4(), id, '/uploads/track1_original.mp3', '/uploads/track1_processed.mp3', 'processed', NOW(), NOW()
FROM public.users WHERE email = 'alice@example.com'
UNION
SELECT public.uuid_generate_v4(), id, '/uploads/track2_original.mp3', '/uploads/track2_processed.mp3', 'processed', NOW(), NOW()
FROM public.users WHERE email = 'bob@example.com'
RETURNING id;

INSERT INTO public.restoration_metadata (restoration_id, title, author, album, year, country, cover_url, created_at, updated_at)
SELECT id, 'Song One', 'Artist One', 'Album One', '2023', 'USA', 'http://example.com/covers/song1.jpg', NOW(), NOW()
FROM public.restorations WHERE file_path_original = '/uploads/track1_original.mp3'
UNION
SELECT id, 'Song Two', 'Artist Two', 'Album Two', '2024', 'UK', 'http://example.com/covers/song2.jpg', NOW(), NOW()
FROM public.restorations WHERE file_path_original = '/uploads/track2_original.mp3';

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

INSERT INTO public.public_library (track_id, likes, play_count)
SELECT id, 10, 100 FROM public.restorations WHERE file_path_original = '/uploads/track1_original.mp3'
UNION
SELECT id, 5, 50 FROM public.restorations WHERE file_path_original = '/uploads/track2_original.mp3';