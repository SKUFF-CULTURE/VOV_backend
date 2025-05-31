# Microservice for music processing

import logging
import time
from pathlib import Path
from music_processing.source.toolbox.check_nfs import check_nfs_server
from kafka_tools import KafkaMessageConsumer, KafkaMessageProducer
from config import KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, ACTOR_GRACE_PERIOD, NFS_MOUNT_POINT

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

def run_processing_pipeline(key, value):
    # Recheck is crucial to track NFS server ability status
    nfs_path = Path(NFS_MOUNT_POINT).resolve()
    if not nfs_path.exists():
        raise FileNotFoundError(f"NFS mount point not found: {nfs_path}")

    task_dir = nfs_path / "audio" / key
    task_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"[Pipeline] Created task directory: {task_dir}")





if __name__ == "__main__":
    logger.info(f"{NAME} | ⏳ Sleeping for {ACTOR_GRACE_PERIOD} seconds...")
    time.sleep(ACTOR_GRACE_PERIOD)
    logger.info("Running external health-checks...")
    if not check_nfs_server(NFS_MOUNT_POINT):
        logger.warning("NFS server is not available! Crucial functionality likely to be unavailable.")
    else:
        logger.info("NFS server is available!")
    try:
        logger.info(f"{NAME} | 🔄 Starting Kafka consumer...")
        consumer.consume_messages(run_processing_pipeline)
    except Exception as e:
        logger.error(f"{NAME} | ❌ Error in Kafka consumer: {e}")
    finally:
        logger.info(f"{NAME} | 🛑 Stopping Kafka consumer...")
        consumer.close()
        producer.flush()