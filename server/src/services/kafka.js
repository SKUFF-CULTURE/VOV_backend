const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'audio-upload-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'], // Адрес брокера из переменной окружения
});

const producer = kafka.producer();

const connectProducer = async () => {
  await producer.connect();
  console.log('Kafka Producer подключён');
};

module.exports = { producer, connectProducer };