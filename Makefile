.PHONY: build run stop logs shell kafka-logs

# Имя контейнера и образа
CONTAINER_NAME=sosalovo
IMAGE_NAME=sosalovo-container

# Сборка Docker-образов через docker-compose
build:
	docker-compose build

rebuild:
	docker-compose build --no-cache

# Запуск контейнеров через docker-compose
run:
	docker-compose up -d

# Остановка и удаление контейнеров
stop:
	docker-compose down

# Вывести логи всех контейнеров
logs:
	docker-compose logs -f

# Зайти внутрь контейнера Flask
shell:
	docker-compose exec flask_app bash

# Зайти внутрь контейнера Kafka
kafka-shell:
	docker-compose exec kafka bash

# Вывести логи Kafka контейнера
kafka-logs:
	docker-compose logs -f kafka