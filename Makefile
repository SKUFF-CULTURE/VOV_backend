.PHONY: build run stop logs shell kafka-logs

# Имя контейнера и образа
CONTAINER_NAME=sosalovo
IMAGE_NAME=sosalovo-container

# Сборка Docker-образов через docker-compose
build:
	cd server && npm install && cd ..
	docker compose build

rebuild:
	cd server && npm install && cd ..
	docker compose build --no-cache

# Запуск контейнеров через docker-compose
run:
	docker compose up -d

# Остановка и удаление контейнеров
stop:
	docker compose down 

flush:
	docker compose down -v

# Вывести логи всех контейнеров
logs:
	docker compose logs -f

# Зайти внутрь контейнера Kafka
kafka-shell:
	docker compose exec sosalovo bash

# Вывести логи Kafka контейнера
kafka-logs:
	docker compose logs -f kafka
# Доступ к бд
db:
	docker compose exec db psql -U postgres -d vov

mistral:
	docker compose exec service_ollama ollama pull mistral

# Перезапуск
reload:
	docker compose down -v && docker compose up --build

# Ребилд без кэша
reboot:
	docker compose down -v && docker compose build --no-cache && docker compose up 

# Пруннинг контейнеров
prune:
	docker compose down -v && docker volume prune && docker image prune && docker container prune && docker network prune

# Очистка всего (осторожно, можно удалить и несвязанные контейнеры)

absdelete:
	docker compose down -v && docker volume rm $(docker volume ls) && docker image rm $(docker image ls) && docker container rm $(dockere container ls)

netdelete:
	docker compose down -v && docker network rm $(docker network ls)