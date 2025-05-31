const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
//Получение данных пользователя
router.get("/account", userController.getAccount);

module.exports = router;
