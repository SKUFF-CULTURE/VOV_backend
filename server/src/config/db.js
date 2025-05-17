// Импортируем Pool из библиотеки pg для работы с базой данных
const { Pool } = require('pg');
// Получаем конфигурацию базы данных из нашего config.js
const config = require('./config');

// Создаем новый Pool с использованием строки подключения
const pool = new Pool({
  connectionString: config.db.connectionString
});
//asdfasdf
// Экспортируем функцию query для выполнения SQL-запросов к базе данных
module.exports = {
  query: (text, params) => pool.query(text, params)
};
