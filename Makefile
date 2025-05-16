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
	docker-compose down -v

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
db:
	docker-compose exec db psql -U postgres -d vov


# Special for arch nerd

# Сборка Docker-образов через docker-compose
build1:
	docker compose build

rebuild1:
	docker compose build --no-cache

# Запуск контейнеров через docker-compose
run1:
	docker compose up -d

# Остановка и удаление контейнеров
stop1:
	docker compose down -v

# Вывести логи всех контейнеров
logs1:
	docker compose logs -f

# Зайти внутрь контейнера Flask
shell1:
	docker compose exec flask_app bash

# Зайти внутрь контейнера Kafka
kafka-shell1:
	docker compose exec kafka bash

# Вывести логи Kafka контейнера
kafka-logs1:
	docker compose logs -f kafka
db1:
	docker compose exec db psql -U postgres -d vov

