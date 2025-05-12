// src/controllers/authController.js
const jwt = require('jsonwebtoken');

exports.profile = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.json({ user: decoded });
  });
};

exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully (remove token on client side)' });
};
