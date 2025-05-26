const es = require("../utils/esClient");

async function ensureIndex() {
  const exists = await es.indices.exists({ index: "tracks" });
  console.log("Elasticsearch: индекс tracks существует:", exists);
  if (!exists) {
    try {
      await es.indices.create({
        index: "tracks",
        body: {
          settings: {
            "index.max_ngram_diff": 7,
            analysis: {
              analyzer: {
                ngram_analyzer: {
                  tokenizer: "ngram_tokenizer",
                  filter: ["lowercase"],
                },
              },
              tokenizer: {
                ngram_tokenizer: {
                  type: "ngram",
                  min_gram: 3,
                  max_gram: 10,
                  token_chars: ["letter", "digit"],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              title: {
                type: "text",
                analyzer: "ngram_analyzer",
                search_analyzer: "standard",
              },
              author: {
                type: "text",
                analyzer: "ngram_analyzer",
                search_analyzer: "standard",
              },
              album: {
                type: "text",
                analyzer: "ngram_analyzer",
                search_analyzer: "standard",
              },
              year: { type: "keyword" },
              country: { type: "keyword" },
              cover_url: { type: "keyword", ignore_above: 100000 },
              is_public: { type: "boolean" },
              user_ids: { type: "keyword" },
            },
          },
        },
      });
      console.log("Elasticsearch: индекс tracks создан");
    } catch (error) {
      console.error("Ошибка при создании индекса tracks:", error.message);
      if (
        error.meta?.body?.error?.type !== "resource_already_exists_exception"
      ) {
        throw error;
      }
      console.log(
        "Elasticsearch: индекс tracks уже существует, ошибка игнорируется"
      );
    }
  }
  console.log("ensureIndex completed");
}

module.exports = { ensureIndex };
