// src/middlewares/jwtAuth.js
const jwt = require('jsonwebtoken');

module.exports = function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // Ожидаем ровно две части: ["Bearer", "<token>"]
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Invalid Authorization header format' });
  }

  const [scheme, token] = parts;
  if (scheme !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization scheme' });
  }
  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const userRole = decoded['https://hasura.io/jwt/claims']?.['x-hasura-default-role'] || decoded.role;
    if (userRole === 'banned') {
      return res.status(403).json({ error: 'Access denied: User is banned' });
    }
    req.user = decoded;
    next();
  });
};

