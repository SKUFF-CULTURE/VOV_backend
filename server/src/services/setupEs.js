//src/services/setupEs.js
const es = require('../utils/esClient');

async function ensureIndex() {
  try {
    // Проверяем существование индекса
    const response = await es.indices.exists({ index: 'tracks' });
    const exists = response.statusCode === 200; // Если 200 — индекс существует, 404 — не существует

    console.log(`Elasticsearch: индекс tracks существует: ${exists}`);

    if (!exists) {
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
    } else {
      console.log('Elasticsearch: индекс tracks уже существует, пропускаем создание');
    }
  } catch (error) {
    if (error.meta && error.meta.statusCode === 400 && error.name === 'ResponseError' && error.body.error.type === 'resource_already_exists_exception') {
      console.log('Elasticsearch: индекс tracks уже существует, ошибка игнорируется');
    } else {
      console.error('Ошибка при проверке/создании индекса tracks:', error);
      throw error;
    }
  }
}

module.exports = { ensureIndex };