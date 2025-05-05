const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const jwtAuth = require('../middlewares/jwtAuth');

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '1h' }
    );
    res.redirect(`http://localhost:3000/dashboard?token=${token}`);
  }
);

// Yandex OAuth
router.get(
  '/yandex',
  passport.authenticate('yandex', { scope: ['login:email'] })
);

router.get(
  '/yandex/callback',
  passport.authenticate('yandex', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '1h' }
    );
    res.redirect(`http://localhost:3000/dashboard?token=${token}`);
  }
);

// Ошибка аутентификации
router.get('/failure', (req, res) => {
  res.status(401).json({ message: "Authentication Failed" });
});

// Защищённые маршруты
router.get('/profile', jwtAuth, authController.profile);
router.get('/logout', authController.logout);

module.exports = router;
