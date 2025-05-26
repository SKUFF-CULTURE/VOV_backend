const { Client } = require("@elastic/elasticsearch");

const node = process.env.ELASTICSEARCH_URL || "http://elasticsearch:9200";
console.log("Elasticsearch node:", node); // Для диагностики

const es = new Client({
  node,
  sniffOnStart: false,
  sniffInterval: false,
});

module.exports = es;
