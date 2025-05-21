const db = require('../config/db.js');
const es = require('../utils/esClient.js');
const { ensureIndex } = require('../services/setupEs.js');

async function waitForElasticsearch() {
  console.log('Waiting for Elasticsearch...');
  for (let i = 0; i < 10; i++) {
    try {
      const health = await es.cluster.health();
      console.log('Elasticsearch is ready:', health);
      return;
    } catch (err) {
      console.error('Elasticsearch not ready, retrying... Error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw new Error('Elasticsearch not available after retries');
}

async function waitForPostgres() {
  console.log('Waiting for PostgreSQL...');
  for (let i = 0; i < 10; i++) {
    try {
      await db.query('SELECT 1');
      console.log('PostgreSQL is ready');
      return;
    } catch (err) {
      console.error('PostgreSQL not ready, retrying... Error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw new Error('PostgreSQL not available after retries');
}

async function reindexAll() {
  await waitForElasticsearch();
  await waitForPostgres();
  console.log('Starting ensureIndex...');
  await ensureIndex();
  console.log('ensureIndex completed');

  const { rows: tracks } = await db.query(`
    SELECT r.id, m.title, m.author, m.album, m.year, m.country, m.cover_url
    FROM public.restorations r
    JOIN public.restoration_metadata m ON m.restoration_id = r.id
  `);
  console.log('Tracks retrieved:', tracks.length, tracks.map(t => ({
    id: t.id,
    title: t.title,
    cover_url: t.cover_url ? `${t.cover_url.slice(0, 50)}... (length: ${t.cover_url.length})` : null
  })));

  const body = tracks.flatMap(t => [
    { index: { _index: 'tracks', _id: t.id.toString() } },
    {
      ...t,
      id: t.id.toString(),
      is_public: true,
      user_ids: [],
      cover_url: t.cover_url && typeof t.cover_url === 'string' ? t.cover_url : null
    }
  ]);
  console.log('Bulk body prepared:', body.map(b => b.index ? b : {
    id: b.id,
    title: b.title,
    cover_url: b.cover_url ? `${b.cover_url.slice(0, 50)}... (length: ${b.cover_url.length})` : null
  }));

  if (body.length === 0) {
    console.log('No tracks to index, skipping bulk operation');
  } else {
    console.log('Performing bulk indexing...');
    try {
      const response = await es.bulk({ refresh: true, body });
      if (response.errors) {
        console.error('Bulk indexing errors:', response.items.filter(item => item.index?.error).map(item => ({
          id: item.index._id,
          error: item.index.error
        })));
      } else {
        console.log('Bulk indexing completed');
      }
    } catch (err) {
      console.error('Bulk indexing failed:', err.message, err.meta);
    }
  }

  const { rows: libs } = await db.query(`
    SELECT user_id, track_id
    FROM public.user_library
  `);
  console.log('Library entries retrieved:', libs.length, libs);

  for (const { user_id, track_id } of libs) {
    console.log(`Updating track ${track_id} for user ${user_id}`);
    try {
      const exists = await es.exists({ index: 'tracks', id: track_id.toString() });
      if (!exists) {
        console.log(`Track ${track_id} not found in index, skipping`);
        continue;
      }
      await es.update({
        index: 'tracks',
        id: track_id.toString(),
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
    } catch (error) {
      console.error(`Failed to update track ${track_id}:`, error);
    }
  }

  console.log('Reindex done');
}

module.exports = { reindexAll };

if (require.main === module) {
  reindexAll().catch(err => {
    console.error('Reindex failed:', err);
    process.exit(1);
  });
}