// серверный скрипт reindex.js
const db = require('../config/db.js');    // <-- именно так, а не деструктурируя Pool
const es = require('../utils/esClient.js');
const { ensureIndex } = require('../services/setupEs.js');

async function reindexAll() {
  await ensureIndex();

  // используем db.query, а не pg.query
  const { rows: tracks } = await db.query(`
    SELECT r.id, m.title, m.author, m.album, m.year, m.country, m.cover_url
    FROM public.restorations r
    JOIN public.restoration_metadata m ON m.restoration_id = r.id
  `);

  const body = tracks.flatMap(t => [
    { index: { _index: 'tracks', _id: t.id } },
    { ...t, is_public: true, user_ids: [] }
  ]);
  await es.bulk({ refresh: true, body });

  const { rows: libs } = await db.query(`
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

reindexAll().catch(err => {
  console.error(err);
  process.exit(1);
});
