// server/scripts/reindex.js
import { Pool } from 'pg';
import es from '../utils/esClient.js';

const pg = new Pool();

async function reindexAll() {
  // 1) Убедимся, что индекс есть
  await import('../services/setupEs.js').then(m => m.ensureIndex());

  // 2) Берём все треки + метаданные
  const { rows: tracks } = await pg.query(`
    SELECT r.id, m.title, m.author, m.album, m.year, m.country, m.cover_url
    FROM public.restorations r
    JOIN public.restoration_metadata m ON m.restoration_id = r.id
  `);

  // 3) bulk index
  const body = tracks.flatMap(t => [
    { index: { _index: 'tracks', _id: t.id } },
    { ...t, is_public: true, user_ids: [] }
  ]);
  await es.bulk({ refresh: true, body });

  // 4) Подтягиваем user_library
  const { rows: libs } = await pg.query(`
    SELECT user_id, track_id
    FROM public.user_library
  `);

  for (const { user_id, track_id } of libs) {
    await es.update({
      index: 'tracks',
      id: track_id,
      body: {
        script: {
          source: `
            if (!ctx._source.user_ids.contains(params.uid)) {
              ctx._source.user_ids.add(params.uid)
            }
          `,
          params: { uid: user_id }
        }
      }
    });
  }

  console.log('Reindex done');
  process.exit(0);
}

reindexAll().catch(err => { console.error(err); process.exit(1); });
