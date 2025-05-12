#!/bin/bash

# Адрес Kafka-брокера
KAFKA_BROKER="${KAFKA_BROKER:-kafka:9092}"

# Список топиков для создания
TOPICS=(
  "app.gnida.changeme"
)

# Проверяем подключение к Kafka
echo "⏳ Waiting for Kafka to start as $KAFKA_BROKER..."
while ! nc -z kafka 9092; do
  sleep 1
done
echo "✅ Kafka is available! Creating topics..."

# Создаём топики
for TOPIC in "${TOPICS[@]}"; do
  echo "🔄 Checking topic $TOPIC..."

  # Проверяем, существует ли топик
  if ! kafka-topics.sh --bootstrap-server "$KAFKA_BROKER" --list | grep -q "$TOPIC"; then
    echo "🚀 Starting topic: $TOPIC"
    kafka-topics.sh --create \
      --bootstrap-server "$KAFKA_BROKER" \
      --replication-factor 1 \
      --partitions 1 \
      --topic "$TOPIC"
    echo "✅ Topic $TOPIC was created!"
  else
    echo "⚡ Topics $TOPIC is already created, skipping..."
  fi
done

echo "🎉 Init completed!"