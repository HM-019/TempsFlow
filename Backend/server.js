require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

function getSecret(name) {
  try {
    return fs.readFileSync(`/run/secrets/${name}`, "utf8").trim();
  } catch {
    return process.env[name];
  }
}

const port = process.env.PORT || 3000;

console.log("\n================= ENV DEBUG =================");
console.log(`MYSQL_DATABASE  = ${process.env.MYSQL_DATABASE}`);
console.log(`MYSQL_HOST      = ${process.env.MYSQL_HOST}`);
console.log(`PORT            = ${port}`);
console.log("=============================================\n");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8080",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many login attempts, try later" },
});

app.use("/api/auth/login", loginLimiter);

// Routes
app.use("/api/auth",   require("./routes/auth.js"));
app.use("/api/shifts", require("./routes/shifts.js"));
app.use("/api/admin",  require("./routes/admin.js"));

app.listen(port, "0.0.0.0", () =>
  console.log(`TempsFlow API running on port ${port}`)
);