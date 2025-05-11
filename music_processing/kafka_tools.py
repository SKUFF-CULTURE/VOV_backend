from confluent_kafka import Producer, Consumer, KafkaError
import logging
import os
from config import KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS
import atexit
import threading

# Настройка логирования
logging.basicConfig(level=logging.INFO)


class KafkaTransceiver:
    def __init__(self, topic=None, group=None):
        self.bootstrap_servers = os.getenv("KAFKA_BROKER", "kafka:9092")
        self.topic = topic or os.getenv("KAFKA_TOPIC", "default_topic")

        self.logger = logging.getLogger(self.__class__.__name__)

        self.producer = Producer({"bootstrap.servers": self.bootstrap_servers})
        self._produce_lock = threading.Lock()

        self.consumer = Consumer({
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": group or os.getenv("KAFKA_GROUP_ID", "default_group"),
            "auto.offset.reset": os.getenv("KAFKA_OFFSET_RESET", "earliest"),
            "enable.auto.commit": False  # Управляем коммитом вручную
        })

        self.consumer.subscribe([self.topic])

        atexit.register(self.close)

    def send_message(self, key: str, value: str, topic=None):
        """Отправка сообщения в Kafka"""
        topic = topic or self.topic

        def delivery_report(err, msg):
            if err:
                self.logger.error(f"❌ Delivery failed: {err}")
            else:
                self.logger.debug(f"✅ Message delivered: {msg.topic()} [{msg.partition()}]")

        try:
            with self._produce_lock:
                self.producer.produce(
                    topic,
                    key=key.encode("utf-8"),
                    value=value.encode("utf-8"),
                    callback=delivery_report
                )
        except Exception as e:
            self.logger.error(f"🔥 Kafka sending error: {e}")

    def consume_messages(self, process_function):
        """Чтение сообщений из Kafka"""
        try:
            self.logger.info(f"[Consumer] Started | Topic: {self.topic}")
            while True:
                try:
                    msg = self.consumer.poll(timeout=1.0)
                except Exception as e:
                    self.logger.error(f"⚠️ Kafka poll error: {e}")
                    continue

                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        self.logger.debug("[Consumer] Reached end of partition")
                        continue
                    else:
                        self.logger.error(f"❌ Consumer error: {msg.error()}")
                        break

                key = msg.key().decode("utf-8") if msg.key() else None
                value = msg.value().decode("utf-8")

                self.logger.info(f"[Consumer] Received message | Key: {key} | Value: {value}")
                process_function(key, value)

                try:
                    self.consumer.commit(msg)
                except Exception as e:
                    self.logger.error(f"⚠️ Commit failed: {e}")

        except KeyboardInterrupt:
            self.logger.info("🛑 Consumer interrupted by user.")
        except Exception as e:
            self.logger.error(f"🔥 Consumer error: {e}")
        finally:
            self.close()

    def close(self):
        """Закрываем Kafka producer и consumer при завершении"""
        self.logger.info("🛑 Closing KafkaTransceiver...")
        self.producer.flush(5)
        self.consumer.close()
        self.logger.info("✅ KafkaTransceiver closed.")


class KafkaInitializer:
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BROKER", "kafka:9092")
        self.topics = KAFKA_TOPICS
        self.groups = KAFKA_CONSUMER_GROUPS
        self.producer = Producer({"bootstrap.servers": self.bootstrap_servers})
        self.logger = logging.getLogger(self.__class__.__name__)

    def init_topics(self):
        for topic in self.topics.values():
            try:
                self.producer.produce(topic, key="Initial", value="")
            except Exception as e:
                self.logger.error(f"[TopicInitializer] Error while initializing topic {topic}: {e}")
        self.producer.flush()
        self.logger.info(f"[TopicInitializer] Topics initialized: {', '.join(self.topics.values())}")
