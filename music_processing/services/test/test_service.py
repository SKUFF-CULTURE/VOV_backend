# Microservice for misc operations

import logging
import json
import time
from music_processing.kafka_tools import KafkaMessageConsumer
from music_processing.config import KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, ACTOR_GRACE_PERIOD

NAME = "SERVICE_PING"

# Настроим логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Получаем топик и группу
topic = KAFKA_TOPICS.get("nettools")
group = KAFKA_CONSUMER_GROUPS.get("nettools_group")

# Инициализируем Kafka consumer
consumer = KafkaMessageConsumer(topic=topic, group=group)


def actor_ping_message(key, value):
    logger.info(f"{NAME}| ✴️ Got kafka message with key: {key}!")
    """Обработка сообщений с пингом."""
    try:
        data = json.loads(value)
        event = data.get("event")
        client_ip = data.get("client_ip")

        if event == "ping":
            logger.info(f"{NAME}| ✅ DONE!!! Received PING from {client_ip}")
            # Здесь можно добавить логику обработки (например, запись в БД)

    except json.JSONDecodeError as e:
        logger.error(f"{NAME} | ❌ JSON decoding error: {e}")
    except Exception as e:
        logger.error(f"{NAME} | ❌ Error processing message: {e}")


if __name__ == "__main__":
    logger.info(f"{NAME} | ⏳ Sleeping for {ACTOR_GRACE_PERIOD} seconds...")
    time.sleep(ACTOR_GRACE_PERIOD)
    try:
        logger.info(f"{NAME} | 🔄 Starting Kafka consumer...")
        consumer.consume_messages(actor_ping_message)
    except Exception as e:
        logger.error(f"{NAME} | ❌ Error in Kafka consumer: {e}")
    finally:
        logger.info(f"{NAME} | 🛑 Stopping Kafka consumer...")
        consumer.close()  # Закрываем consumer корректно
