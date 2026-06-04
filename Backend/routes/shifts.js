const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth.js");

// POST /api/shifts/clock-in
// Body: { work_date }
// Creates a new shift row with clock_in = now
// Protected by: authMiddleware
router.post("/clock-in", authMiddleware, async (req, res) => {
  const { work_date } = req.body;

  if (!work_date)
    return res.status(400).json({ error: "work_date is required" });

  try {
    // Check if employee already clocked in today
    const [existing] = await pool.query(
      "SELECT id FROM shifts WHERE user_id = ? AND work_date = ? AND clock_out IS NULL",
      [req.user.id, work_date]
    );

    if (existing.length > 0)
      return res.status(409).json({ error: "Already clocked in for this date" });

    const clock_in = new Date();

    const [result] = await pool.query(
      "INSERT INTO shifts (user_id, work_date, clock_in) VALUES (?, ?, ?)",
      [req.user.id, work_date, clock_in]
    );

    return res.status(201).json({
      message: "Clocked in successfully",
      shift: {
        id: result.insertId,
        user_id: req.user.id,
        work_date,
        clock_in,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/shifts/clock-out
// Body: { shift_id }
// Updates shift row with clock_out = now and calculates worked_hours (in minutes)
// Protected by: authMiddleware
router.post("/clock-out", authMiddleware, async (req, res) => {
  const { shift_id } = req.body;

  if (!shift_id)
    return res.status(400).json({ error: "shift_id is required" });

  try {
    // Make sure shift belongs to logged-in user and is not already closed
    const [rows] = await pool.query(
      "SELECT * FROM shifts WHERE id = ? AND user_id = ? AND clock_out IS NULL",
      [shift_id, req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Shift not found or already clocked out" });

    const shift = rows[0];
    const clock_out = new Date();
    const worked_hours = Math.round((clock_out - new Date(shift.clock_in)) / 60000); // in minutes

    await pool.query(
      "UPDATE shifts SET clock_out = ?, worked_hours = ? WHERE id = ?",
      [clock_out, worked_hours, shift_id]
    );

    return res.status(200).json({
      message: "Clocked out successfully",
      shift: {
        id: shift_id,
        clock_in: shift.clock_in,
        clock_out,
        worked_hours,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/me
// Returns all shifts for the logged-in employee
// Protected by: authMiddleware
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM shifts WHERE user_id = ? ORDER BY work_date DESC",
      [req.user.id]
    );

    return res.status(200).json({ shifts: rows });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/me/month/:month
// Param: month (e.g. 05)
// Returns shifts filtered by month for logged-in employee
// Protected by: authMiddleware
router.get("/me/month/:month", authMiddleware, async (req, res) => {
  const { month } = req.params;

  if (!month || isNaN(month) || month < 1 || month > 12)
    return res.status(400).json({ error: "Invalid month" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM shifts WHERE user_id = ? AND MONTH(work_date) = ? ORDER BY work_date DESC",
      [req.user.id, month]
    );

    return res.status(200).json({ shifts: rows });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/shifts/corrections
// Body: { request_date, correction_type, requested_time, reason }
// Creates a correction request with status = pending
// Protected by: authMiddleware
router.post("/corrections", authMiddleware, async (req, res) => {
  const { request_date, correction_type, requested_time, reason } = req.body;

  if (!request_date || !correction_type || !requested_time)
    return res.status(400).json({ error: "request_date, correction_type and requested_time are required" });

  const validTypes = ["forgot_clock_in", "forgot_clock_out"];
  if (!validTypes.includes(correction_type))
    return res.status(400).json({ error: "correction_type must be forgot_clock_in or forgot_clock_out" });

  try {
    const [result] = await pool.query(
      "INSERT INTO correction_requests (user_id, request_date, correction_type, requested_time, reason) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, request_date, correction_type, requested_time, reason || null]
    );

    return res.status(201).json({
      message: "Correction request submitted",
      correction: {
        id: result.insertId,
        user_id: req.user.id,
        request_date,
        correction_type,
        requested_time,
        reason: reason || null,
        status: "pending",
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/corrections/me
// Returns all correction requests submitted by logged-in employee
// Protected by: authMiddleware
router.get("/corrections/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM correction_requests WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );

    return res.status(200).json({ corrections: rows });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/summary/today
// Returns total minutes worked today for logged-in employee
// Protected by: authMiddleware
router.get("/summary/today", authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(worked_hours), 0) AS worked_minutes
       FROM shifts
       WHERE user_id = ? AND work_date = ? AND clock_out IS NOT NULL`,
      [req.user.id, today]
    );

    return res.status(200).json({ worked_minutes: rows[0].worked_minutes });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/summary/week
// Returns total minutes worked this week (Monday to Sunday)
// Protected by: authMiddleware
router.get("/summary/week", authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday...
    const diffToMonday = (day === 0 ? -6 : 1 - day);

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const week_start = monday.toISOString().split("T")[0];
    const week_end = sunday.toISOString().split("T")[0];

    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(worked_hours), 0) AS worked_minutes
       FROM shifts
       WHERE user_id = ? AND work_date BETWEEN ? AND ? AND clock_out IS NOT NULL`,
      [req.user.id, week_start, week_end]
    );

    return res.status(200).json({
      worked_minutes: rows[0].worked_minutes,
      week_start,
      week_end,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/summary/month/:month
// Returns total minutes worked in a given month + days worked
// Month is a number e.g. 05 for May
// Protected by: authMiddleware
router.get("/summary/month/:month", authMiddleware, async (req, res) => {
  const { month } = req.params;

  if (!month || isNaN(month) || month < 1 || month > 12)
    return res.status(400).json({ error: "Invalid month" });

  try {
    const year = new Date().getFullYear();

    // First and last day of the month
    const month_start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const month_end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

    const [rows] = await pool.query(
      `SELECT 
        COALESCE(SUM(worked_hours), 0) AS worked_minutes,
        COUNT(*) AS days_worked
       FROM shifts
       WHERE user_id = ? AND work_date BETWEEN ? AND ? AND clock_out IS NOT NULL`,
      [req.user.id, month_start, month_end]
    );

    return res.status(200).json({
      worked_minutes: rows[0].worked_minutes,
      days_worked: rows[0].days_worked,
      month_start,
      month_end,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/shifts/salary/:month
// Returns salary summary for the logged-in employee for a given month
// Protected by: authMiddleware
router.get("/salary/:month", authMiddleware, async (req, res) => {
  const { month } = req.params;

  if (!month || isNaN(month) || month < 1 || month > 12)
    return res.status(400).json({ error: "Invalid month" });

  try {
    // Get employee contract hours
    const [users] = await pool.query(
      "SELECT contract_hours FROM users WHERE id = ?",
      [req.user.id]
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
      [req.user.id, month_start, month_end]
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

// POST /api/shifts/manual
// Body: { work_date, clock_in, clock_out }
// Employee adds a missed day manually
// Protected by: authMiddleware
router.post("/manual", authMiddleware, async (req, res) => {
  const { work_date, clock_in, clock_out } = req.body;

  if (!work_date || !clock_in || !clock_out)
    return res.status(400).json({ error: "work_date, clock_in and clock_out are required" });

  try {
    // Check if a shift already exists for this date
    const [existing] = await pool.query(
      "SELECT id FROM shifts WHERE user_id = ? AND work_date = ?",
      [req.user.id, work_date]
    );

    if (existing.length > 0)
      return res.status(409).json({ error: "A shift already exists for this date" });

    const [inH, inM]   = clock_in.split(':').map(Number);
    const [outH, outM] = clock_out.split(':').map(Number);

    // Subtract 2 hours to compensate for MySQL timezone offset
    const adjInH  = inH  - 2;
    const adjOutH = outH - 2;

    // Handle day boundary (e.g. 00:30 becomes 22:30 previous day)
    const finalInH  = ((adjInH  % 24) + 24) % 24;
    const finalOutH = ((adjOutH % 24) + 24) % 24;

    const clockInStr  = `${work_date} ${String(finalInH).padStart(2,'0')}:${String(inM).padStart(2,'0')}:00`;
    const clockOutStr = `${work_date} ${String(finalOutH).padStart(2,'0')}:${String(outM).padStart(2,'0')}:00`;

    const inMinutes  = inH * 60 + inM;
    let   outMinutes = outH * 60 + outM;
    if (outMinutes <= inMinutes) outMinutes += 24 * 60;
    const worked_hours = outMinutes - inMinutes;

    const [result] = await pool.query(
      "INSERT INTO shifts (user_id, work_date, clock_in, clock_out, worked_hours) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, work_date, clockInStr, clockOutStr, worked_hours]
    );

    return res.status(201).json({
      message: "Shift added successfully",
      shift: {
        id: result.insertId,
        user_id: req.user.id,
        work_date,
        clock_in: clockInStr,
        clock_out: clockOutStr,
        worked_hours,
      },
    });
  } catch (err) {
    console.error('MANUAL SHIFT ERROR;', err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/shifts/:id
// Body: { clock_in, clock_out }
// Employee edits an existing shift's times and recalculates worked_hours
// Protected by: authMiddleware
router.patch("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { clock_in, clock_out } = req.body;

  if (!clock_in || !clock_out)
    return res.status(400).json({ error: "clock_in and clock_out are required" });

  try {
    // Make sure shift belongs to logged-in user
    const [rows] = await pool.query(
      "SELECT * FROM shifts WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Shift not found" });

    const shift = rows[0];
    const work_date = shift.work_date.toISOString
      ? shift.work_date.toISOString().split("T")[0]
      : shift.work_date.toString().split("T")[0];

    const [inH, inM]   = clock_in.split(':').map(Number);
    const [outH, outM] = clock_out.split(':').map(Number);

    // Subtract 2 hours to compensate for MySQL timezone offset
    const adjInH  = inH  - 2;
    const adjOutH = outH - 2;

    // Handle day boundary (e.g. 00:30 becomes 22:30 previous day)
    const finalInH  = ((adjInH  % 24) + 24) % 24;
    const finalOutH = ((adjOutH % 24) + 24) % 24;

    const clockInStr  = `${work_date} ${String(finalInH).padStart(2,'0')}:${String(inM).padStart(2,'0')}:00`;
    const clockOutStr = `${work_date} ${String(finalOutH).padStart(2,'0')}:${String(outM).padStart(2,'0')}:00`;

    const inMinutes  = inH * 60 + inM;
    let   outMinutes = outH * 60 + outM;
    if (outMinutes <= inMinutes) outMinutes += 24 * 60;
    const worked_hours = outMinutes - inMinutes;

    await pool.query(
      "UPDATE shifts SET clock_in = ?, clock_out = ?, worked_hours = ? WHERE id = ?",
      [clockInStr, clockOutStr, worked_hours, id]
    );

    return res.status(200).json({
      message: "Shift updated successfully",
      shift: {
        id,
        work_date,
        clock_in: clockInStr,
        clock_out: clockOutStr,
        worked_hours,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;