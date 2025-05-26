const express = require("express");
const es = require("../utils/esClient");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { q, from = 0, size = 10, sort } = req.query;
    const fromNum = parseInt(from, 10);
    const sizeNum = parseInt(size, 10);

    if (isNaN(fromNum) || fromNum < 0)
      throw new Error('Invalid "from" parameter');
    if (isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100)
      throw new Error('Invalid "size" parameter');
    if (q && q.length < 3)
      throw new Error("Search query must be at least 3 characters long"); // Регулируем длинну поискового запроса

    const must = q
      ? {
          query_string: {
            query: `*${q}*`,
            fields: ["title^3", "author^2", "album"],
            default_operator: "AND",
          },
        }
      : { match_all: {} };

    const filter = [{ term: { is_public: true } }];

    const sortArray = sort
      ? sort.split(",").map((s) => {
          const [field, order] = s.split(":");
          return { [field]: { order: order || "asc" } };
        })
      : [{ _score: { order: "desc" } }];

    const body = {
      query: { bool: { must, filter } },
      from: fromNum,
      size: sizeNum,
      sort: sortArray,
    };

    console.log("Search query:", JSON.stringify(body, null, 2));
    let response;
    try {
      response = await es.search({
        index: "tracks",
        body,
      });
    } catch (err) {
      console.error("Elasticsearch search error:", err.message, err.meta);
      throw new Error("Failed to query Elasticsearch");
    }

    console.log("Elasticsearch response:", JSON.stringify(response, null, 2));

    const hits = response?.hits?.hits || [];
    const total = response?.hits?.total?.value || 0;

    console.log("Search results:", { total, hits: hits.length });

    res.json({
      tracks: hits.map((h) => h._source),
      total,
      from: fromNum,
      size: sizeNum,
    });
  } catch (err) {
    console.error("Search error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
