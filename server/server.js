const app = require("./src/app");

const config = require("./src/config/config");
const { initBuckets } = require("./src/utils/minio-init");

const PORT = config.port || 5000;

// Инициализация бакетов и старт сервера
initBuckets()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to init MinIO buckets:", err);
    process.exit(1);
  });
