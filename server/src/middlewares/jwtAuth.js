// src/middlewares/jwtAuth.js
const jwt = require('jsonwebtoken');

module.exports = function jwtAuth(req, res, next) {
  // Получаем заголовок авторизации
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // Ожидаем формат "Bearer <token>"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  // Проверяем токен с использованием секретного ключа
  jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // Если токен действителен, сохраняем декодированные данные в req.user
    req.user = decoded;
    next();
  });
};
