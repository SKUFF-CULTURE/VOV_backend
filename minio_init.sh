#!/bin/sh
set -e

echo "⏳ Waiting for MinIO to be ready..."

# Пытаемся подключиться к MinIO с таймаутом
until curl -s http://localhost:9000/minio/health/ready | grep -q "OK"
do
  echo "⏳ MinIO not ready yet, waiting..."
  sleep 2
done

echo "✅ MinIO is ready. Setting up buckets..."

# Настройка клиента mc
mc alias set myminio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# Создаем бакеты
mc mb myminio/originals --ignore-existing
mc mb myminio/processed --ignore-existing

# Настраиваем политики доступа (например, публичный доступ)
mc anonymous set download myminio/originals
mc anonymous set download myminio/processed

echo "✅ MinIO initialized!"
