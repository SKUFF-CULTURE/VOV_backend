from confluent_kafka import Producer, Consumer, KafkaError
import threading
import os
import logging

class KafkaMessageProducer:
    def __init__(self, topic):
        self.bootstrap_servers = os.getenv("KAFKA_BROKER", "kafka:9092")
        self.topic = topic
        self.logger = logging.getLogger(self.__class__.__name__)
        self.producer = Producer({"bootstrap.servers": self.bootstrap_servers})
        self._lock = threading.Lock()

    def send_message(self, key: str, value: str, topic=None):
        topic = topic or self.topic

        def delivery_report(err, msg):
            if err:
                self.logger.error(f"[Producer] Delivery failed: {err}")
            else:
                self.logger.debug(f"[Producer] Delivered to {msg.topic()} [{msg.partition()}]")

        with self._lock:
            self.producer.produce(
                topic,
                key=key.encode("utf-8"),
                value=value.encode("utf-8"),
                callback=delivery_report
            )

    def flush(self):
        self.producer.flush()

class KafkaMessageConsumer:
    def __init__(self, topic, group):
        self.bootstrap_servers = os.getenv("KAFKA_BROKER", "kafka:9092")
        self.topic = topic
        self.group = group
        self.logger = logging.getLogger(self.__class__.__name__)
        self.consumer = Consumer({
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": self.group,
            "auto.offset.reset": os.getenv("KAFKA_OFFSET_RESET", "earliest"),
            "enable.auto.commit": False
        })
        self.consumer.subscribe([self.topic])

    def consume_messages(self, handler_fn):
        try:
            self.logger.info(f"[Consumer] Subscribed to {self.topic} | Group: {self.group}")
            while True:
                msg = self.consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        self.logger.error(f"[Consumer] Error: {msg.error()}")
                        break
                key = msg.key().decode("utf-8") if msg.key() else None
                value = msg.value().decode("utf-8")
                handler_fn(key, value)
                self.consumer.commit(msg)
        except KeyboardInterrupt:
            self.logger.info("[Consumer] Interrupted by user.")
        finally:
            self.consumer.close()

    def close(self):
        self.consumer.close()
