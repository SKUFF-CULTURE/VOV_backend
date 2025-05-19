// server/routes/search.js
const express = require('express')
const es = require('../utils/esClient')
const router = express.Router();

// /api/search?q=beatles&userId=123
router.get('/', async (req, res, next) => {
  try {
    const { q, userId } = req.query;
    const must = q
      ? {
          multi_match: {
            query:  q,
            fields: ['title^3','author','album']
          }
        }
      : { match_all: {} };

    const filter = userId
      ? { term: { user_ids: userId } }
      : null;

    const body = filter
      ? { query: { bool: { must, filter } } }
      : { query: must };

    const { body: result } = await es.search({
      index: 'tracks',
      body
    });

    const hits = result.hits.hits.map(h => h._source);
    res.json(hits);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
