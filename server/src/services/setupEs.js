// src/services/setupEs.js
const es = require('../utils/esClient');

async function ensureIndex() {
  const exists = await es.indices.exists({ index: 'tracks' });
  if (!exists.body) {
    await es.indices.create({
      index: 'tracks',
      body: {
        mappings: {
          properties: {
            id:        { type: 'keyword' },
            title:     { type: 'text' },
            author:    { type: 'text' },
            album:     { type: 'text' },
            year:      { type: 'keyword' },
            country:   { type: 'keyword' },
            cover_url: { type: 'keyword' },
            is_public: { type: 'boolean' },
            user_ids:  { type: 'keyword' }
          }
        }
      }
    });
    console.log('Elasticsearch: индекс tracks создан');
  }
}

// экспортируем функцию в стиле CommonJS
module.exports = { ensureIndex };
