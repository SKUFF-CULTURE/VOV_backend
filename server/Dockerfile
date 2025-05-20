FROM node:18

WORKDIR /app

# Сначала только package.json и package-lock.json,
# чтобы воспользоваться кэшом слоёв
COPY package*.json ./
RUN npm install

# Копируем локальные модели (предполагается, что на хосте есть ./models/)
COPY node_modules/ ./node_modules/

# Копируем остальной исходный код приложения, но без моделей
COPY src/ ./src/
# если есть другие директории — копируйте их явно:
# COPY config/ ./config/

EXPOSE 5000

CMD ["npm", "run", "dev"]
