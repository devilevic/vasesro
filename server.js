const path = require("path");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

// Helmet CSP off to keep embeds/simple static content easy
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Postgres ----
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Create table once
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT,
      preferred TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      page TEXT,
      user_agent TEXT,
      ip TEXT
    );
  `);
}
initDb().catch(err => {
  console.error("DB init failed:", err);
  process.exit(1);
});

// ---- Static site ----
// IMPORTANT: This serves your existing HTML/CSS/assets exactly as before.
app.use(express.static(path.join(__dirname)));

// ---- Contact API ----
app.post("/api/contact", async (req, res) => {
  try {
    const {
      name, email, phone, service, preferred, subject, message, page
    } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    const ua = req.get("user-agent") || "";
    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "";

    await pool.query(
      `INSERT INTO contacts (name,email,phone,service,preferred,subject,message,page,user_agent,ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [name, email, phone, service || null, preferred || null, subject || null, message, page || null, ua, ip]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ---- Admin auth (Basic Auth) ----
// Env vars needed:
// ADMIN_USER
// ADMIN_PASS_HASH  (bcrypt hash)
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required.");
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [user, pass] = decoded.split(":");

  if (user !== process.env.ADMIN_USER) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required.");
  }

  const ok = bcrypt.compareSync(pass || "", process.env.ADMIN_PASS_HASH || "");
  if (!ok) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required.");
  }

  next();
}

// Admin dashboard page
app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Admin API
app.get("/api/admin/contacts", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, name, email, phone, service, preferred, subject, message, page
       FROM contacts
       ORDER BY created_at DESC
       LIMIT 500`
    );
    res.json({ ok: true, rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server listening on", port));