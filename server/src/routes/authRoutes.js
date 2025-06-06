// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const authController = require("../controllers/authController");
const jwtAuth = require("../middlewares/jwtAuth");

function issueTokenAndRedirect(req, res) {
  const { id, email, role, name, avatar_url } = req.user;
  if (role === "banned") {
    return res.redirect("http://localhost:5173/banned");
  }

  const payload = {
    "https://hasura.io/jwt/claims": {
      "x-hasura-allowed-roles": [role, "user"], // Включаем текущую роль и 'user' как запасную
      "x-hasura-default-role": role || "user", // По умолчанию используем роль из БД или 'user'
      "x-hasura-user-id": id.toString(), // ID пользователя как строка
      "x-hasura-email": email,
      "x-hasura-name": name,
      "x-hasura-avatar-url": avatar_url,
    },
    id,
    email,
    role,
    name,
    avatar_url,
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || "default_jwt_secret",
    { expiresIn: "1h" }
  );

  // пересылаем на фронт вместе с токеном
  res.redirect(`http://localhost:5173/callback?token=${token}`);
  //res.json({ token, user: req.user });
}

// Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure" }),
  issueTokenAndRedirect
);

// Yandex
router.get(
  "/yandex",
  passport.authenticate("yandex", { scope: ["login:info", "login:email"] })
);
router.get(
  "/yandex/callback",
  passport.authenticate("yandex", { failureRedirect: "/auth/failure" }),
  issueTokenAndRedirect
);

// Ошибка аутентификации
router.get("/failure", (req, res) =>
  res.status(401).json({ message: "Authentication Failed" })
);

// Защищенные маршруты
router.get("/profile", jwtAuth, authController.profile);
router.get("/logout", authController.logout);

module.exports = router;
