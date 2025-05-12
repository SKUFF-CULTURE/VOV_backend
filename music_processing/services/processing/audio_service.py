# Microservice for music processing

import logging
import json
import time
from music_processing.kafka_tools import KafkaMessageConsumer, KafkaMessageProducer
from music_processing.config import KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, ACTOR_GRACE_PERIOD

NAME = "SERVICE_AUDIO"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Kafka consuming (IN)
in_topic = KAFKA_TOPICS.get("audio_raw")
in_group = KAFKA_CONSUMER_GROUPS.get("audio_group")

consumer = KafkaMessageConsumer(topic=in_topic, group=in_group)

# Kafka producing (OUT)

out_topic = KAFKA_TOPICS.get("audio_processed")

producer = KafkaMessageProducer(topic=out_topic)

def main():
    pass

if __name__ == "__main__":
    logger.info(f"{NAME} | ⏳ Sleeping for {ACTOR_GRACE_PERIOD} seconds...")
    time.sleep(ACTOR_GRACE_PERIOD)
    try:
        logger.info(f"{NAME} | 🔄 Starting Kafka consumer...")
        consumer.consume_messages(main)
    except Exception as e:
        logger.error(f"{NAME} | ❌ Error in Kafka consumer: {e}")
    finally:
        logger.info(f"{NAME} | 🛑 Stopping Kafka consumer...")
        consumer.close()
        producer.flush()