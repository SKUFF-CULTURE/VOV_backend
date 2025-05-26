// src/controllers/authController.js

// Теперь req.user уже содержит { id, email, role, name, avatar_url }
exports.profile = (req, res) => {
  res.json(req.user);
};

exports.logout = (req, res) => {
  res.json({
    message: "Logged out successfully (remove token on client side)",
  });
};
