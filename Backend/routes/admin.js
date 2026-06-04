const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../db");
const authMiddleware = require("../middleware/auth.js");
const isAdmin = require("../middleware/isAdmin.js");

// All routes in this file are protected by auth + isAdmin
router.use(authMiddleware, isAdmin);

// ============================================================
//  USERS
// ============================================================

// GET /api/admin/users
// Returns list of all users
router.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, first_name, last_name, role, created_at FROM users ORDER BY last_name ASC"
    );

    return res.status(200).json({ users: rows });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/users/:id
// Returns one user's profile
router.get("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT id, username, first_name, last_name, role, created_at FROM users WHERE id = ?",
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/admin/users
// Body: { username, password, first_name, last_name, role }
// Creates a new user account
router.post("/users", async (req, res) => {
  const { username, password, first_name, last_name, role, contract_hours } = req.body;

  if (!username || !password || !first_name || !last_name || !role || contract_hours === undefined)
    return res.status(400).json({ error: "All fields are required" });

  const validRoles = ["employee", "admin"];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: "role must be employee or admin" });

  try {
    // Check if username already exists
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existing.length > 0)
      return res.status(409).json({ error: "Username already in use" });

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash, first_name, last_name, role, contract_hours) VALUES (?, ?, ?, ?, ?, ?)",
      [username, password_hash, first_name, last_name, role, contract_hours]
    );

    return res.status(201).json({
      message: "User created",
      user: {
        id: result.insertId,
        username,
        first_name,
        last_name,
        role,
        contract_hours,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/admin/users/:id
// Deletes a user account
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id = ?",
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    await pool.query("DELETE FROM users WHERE id = ?", [id]);

    return res.status(200).json({ message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
//  SHIFTS
// ============================================================

// GET /api/admin/shifts/:userId
// Returns all shifts for a specific employee
router.get("/shifts/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM shifts WHERE user_id = ? ORDER BY work_date DESC",
      [userId]
    );

    return res.status(200).json({ shifts: rows });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/admin/shifts/:userId/month/:month
// Returns shifts for a specific employee filtered by month
router.get("/shifts/:userId/month/:month", async (req, res) => {
  const { userId, month } = req.params;

  if (!month || isNaN(month) || month < 1 || month > 12)
    return res.status(400).json({ error: "Invalid month" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM shifts WHERE user_id = ? AND MONTH(work_date) = ? ORDER BY work_date DESC",
      [userId, month]
    );

    return res.status(200).json({ shifts: rows });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
//  CORRECTIONS
// ============================================================

// GET /api/admin/users/:id/salary/:month
// Returns salary summary for a specific employee for a given month
// Protected by: auth.js + isAdmin.js
router.get("/users/:id/salary/:month", async (req, res) => {
  const { id, month } = req.params;

  if (!month || isNaN(month) || month < 1 || month > 12)
    return res.status(400).json({ error: "Invalid month" });

  try {
    // Get employee contract hours
    const [users] = await pool.query(
      "SELECT contract_hours FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0)
      return res.status(404).json({ error: "User not found" });

    const contract_hours = users[0].contract_hours;

    // Get total worked minutes for the month
    const year = new Date().getFullYear();
    const month_start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const month_end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(worked_hours), 0) AS worked_minutes
       FROM shifts
       WHERE user_id = ? AND work_date BETWEEN ? AND ? AND clock_out IS NOT NULL`,
      [id, month_start, month_end]
    );

    const worked_minutes = rows[0].worked_minutes;
    const worked_hours_real = worked_minutes / 60;

    const contract_rate = 9.56;
    const extra_rate = 8.00;

    const contract_hours_worked = Math.min(worked_hours_real, contract_hours);
    const contract_salary = parseFloat((contract_hours_worked * contract_rate).toFixed(2));
    const contract_salary_max = parseFloat((contract_hours * contract_rate).toFixed(2));

    const extra_hours = parseFloat(Math.max(0, worked_hours_real - contract_hours).toFixed(2));
    const extra_salary = parseFloat((extra_hours * extra_rate).toFixed(2));

    const contract_filled = worked_hours_real >= contract_hours;
    const progress = parseFloat(Math.min((worked_hours_real / contract_hours) * 100, 100).toFixed(1));

    return res.status(200).json({
      contract_hours,
      worked_minutes,
      worked_hours_real: parseFloat(worked_hours_real.toFixed(2)),
      contract_salary,
      contract_salary_max,
      extra_hours,
      extra_salary,
      contract_filled,
      progress,
      month_start,
      month_end,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/admin/users/:id/password
// Body: { new_password }
// Admin resets password for any user
// Protected by: auth.js + isAdmin.js
router.patch("/users/:id/password", async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password)
    return res.status(400).json({ error: "new_password is required" });

  try {
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id = ?",
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const password_hash = await bcrypt.hash(new_password, 12);

    await pool.query(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [password_hash, id]
    );

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;