// server/utils/esClient.js
const { Client } = require('@elastic/elasticsearch');

const es = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

module.exports = es;
