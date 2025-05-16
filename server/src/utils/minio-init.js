// src/minio-init.js
const Minio = require('minio');

const minioClient = new Minio.Client({
  endPoint:   process.env.MINIO_ENDPOINT || 'localhost',
  port:       +process.env.MINIO_PORT  || 9000,
  useSSL:     process.env.MINIO_USE_SSL === 'true',
  accessKey:  process.env.MINIO_ACCESS_KEY,
  secretKey:  process.env.MINIO_SECRET_KEY,
});

/**
 * Убедиться, что бакет существует, и создать, если нет.
 * @param {string} bucketName
 */
async function ensureBucket(bucketName) {
  return new Promise((resolve, reject) => {
    minioClient.bucketExists(bucketName, (err, exists) => {
      if (err) return reject(err);
      if (exists) {
        console.log(`Bucket "${bucketName}" already exists`);
        return resolve();
      }
      // создаём бакет в регионе us-east-1 (можно вынести в конфиг)
      minioClient.makeBucket(bucketName, 'us-east-1', err => {
        if (err) return reject(err);
        console.log(`Bucket "${bucketName}" created`);
        resolve();
      });
    });
  });
}

/**
 * Инициализация всех нужных бакетов.
 */
async function initBuckets() {
  const buckets = [
    process.env.MINIO_ORIGINAL_BUCKET  || 'original',
    process.env.MINIO_PROCESSED_BUCKET || 'processed'
  ];
  for (const name of buckets) {
    try {
      await ensureBucket(name);
    } catch (err) {
      console.error(`Failed to init bucket "${name}":`, err);
      process.exit(1);
    }
  }
}

module.exports = { minioClient, initBuckets };
