FROM node:18

WORKDIR /app

# Сначала только package.json и package-lock.json,
# чтобы воспользоваться кэшом слоёв
COPY package*.json ./
RUN npm install

# Копируем локальные модели (предполагается, что на хосте есть ./models/)
COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
