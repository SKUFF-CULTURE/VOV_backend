// src/utils/converter.js
// Node.js скрипт для извлечения метаданных аудиофайлов и сохранения в PostgreSQL через db.query

const fs = require('fs').promises;
const path = require('path');
const mm = require('music-metadata');
const db = require('../config/db'); // Использует config/db.js

const SUPPORTED_EXT = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac'];

// Создание таблицы songs, если не существует
async function ensureSongsTable() {
  const createQuery = `
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      path TEXT UNIQUE,
      format TEXT,
      title TEXT,
      artist TEXT,
      album TEXT,
      genre TEXT,
      track_number TEXT,
      date TEXT,
      duration INT
    )`;
  await db.query(createQuery);
}

// Извлечение метаданных из одного файла
async function extractMetadata(filePath) {
  try {
    const meta = await mm.parseFile(filePath, { duration: true });
    const common = meta.common;
    return {
      path: filePath,
      format: path.extname(filePath).slice(1),
      title: common.title || null,
      artist: common.artist || null,
      album: common.album || null,
      genre: Array.isArray(common.genre) ? common.genre.join(', ') : common.genre || null,
      track_number: common.track && common.track.no ? String(common.track.no) : null,
      date: common.year ? String(common.year) : null,
      duration: meta.format.duration ? Math.round(meta.format.duration) : null
    };
  } catch (err) {
    console.warn(`Не удалось прочитать метаданные ${filePath}: ${err.message}`);
    return null;
  }
}

// Рекурсивное сканирование директории
async function scanDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await scanDirectory(fullPath));
    } else if (SUPPORTED_EXT.includes(path.extname(entry.name).toLowerCase())) {
      const meta = await extractMetadata(fullPath);
      if (meta) results.push(meta);
    }
  }
  return results;
}

// Сохранение или обновление метаданных в БД
async function saveMetadata(meta) {
  const query = `
    INSERT INTO songs (path, format, title, artist, album, genre, track_number, date, duration)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (path) DO UPDATE SET
      format      = EXCLUDED.format,
      title       = EXCLUDED.title,
      artist      = EXCLUDED.artist,
      album       = EXCLUDED.album,
      genre       = EXCLUDED.genre,
      track_number= EXCLUDED.track_number,
      date        = EXCLUDED.date,
      duration    = EXCLUDED.duration;
  `;
  const values = [
    meta.path, meta.format, meta.title, meta.artist,
    meta.album, meta.genre, meta.track_number,
    meta.date, meta.duration
  ];
  await db.query(query, values);
}

// CLI: node converter.js /path/to/music
if (require.main === module) {
  (async () => {
    const inputDir = process.argv[2];
    if (!inputDir) {
      console.error('Usage: node converter.js <music-directory>');
      process.exit(1);
    }

    try {
      const stat = await fs.stat(inputDir);
      if (!stat.isDirectory()) throw new Error('Not a directory');
    } catch {
      console.error(`Directory not found: ${inputDir}`);
      process.exit(1);
    }

    await ensureSongsTable();
    const allMeta = await scanDirectory(inputDir);
    for (const meta of allMeta) {
      await saveMetadata(meta);
    }
    console.log(`Saved metadata for ${allMeta.length} files.`);
    process.exit(0);
  })().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
