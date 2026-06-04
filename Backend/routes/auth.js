const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authMiddleware = require("../middleware/auth.js");

const SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
// Body: { username, password }
// Returns: { token, user }
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0)
      return res.status(400).json({ error: "Invalid credentials" });

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ error: "Wrong password" });

    // Sign token with id and role (role is a string: 'employee' or 'admin')
    const token = jwt.sign(
      { id: user.id, role: user.role },
      SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (err) {
      console.error("LOGIN ERROR:", err)
      return res.status(500).json({
         error: "Server error",
        details: err.message 
      });
  }
});

// GET /api/auth/me
// Returns current logged-in user info
// Protected by: authMiddleware
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, first_name, last_name, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;