const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve your existing static site (index.html, styles.css, assets/, etc.)
app.use(express.static(path.join(__dirname)));

// Persistent storage directory (Render Disk mount path will be /var/data)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, "[]", "utf8");
}

function readContacts() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(CONTACTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeContacts(list) {
  ensureStorage();
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(list, null, 2), "utf8");
}

// ---- Contact API ----
app.post("/api/contact", (req, res) => {
  try {
    const { name, email, phone, service, preferred, subject, message, page } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    const ua = req.get("user-agent") || "";
    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "";

    const list = readContacts();
    const entry = {
      id: Date.now(), // simple unique id
      created_at: new Date().toISOString(),
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      service: service ? String(service) : "",
      preferred: preferred ? String(preferred) : "",
      subject: subject ? String(subject) : "",
      message: String(message).trim(),
      page: page ? String(page) : "",
      user_agent: ua,
      ip
    };

    list.unshift(entry);
    writeContacts(list);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ---- Admin auth (Basic Auth) ----
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
app.get("/api/admin/contacts", requireAdmin, (req, res) => {
  const list = readContacts();
  res.json({ ok: true, rows: list.slice(0, 500) });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server listening on", port));