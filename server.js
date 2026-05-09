const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── File Paths ───────────────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, "db.json");
const LCD_FILE = path.join(__dirname, "lcd.txt");

// ─── Init DB if not exists ────────────────────────────────────────────────────
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ users: [], sensors: [], predictions: [] }, null, 2),
  );
}
if (!fs.existsSync(LCD_FILE)) {
  fs.writeFileSync(LCD_FILE, "Hello SISTec!");
}

// ─── Bulletproof DB Helpers ───────────────────────────────────────────────────
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("DB Read Collision - Preventing Crash");
    // If file is locked, return empty structure so server doesn't crash
    return { users: [], sensors: [], predictions: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("DB Write Collision - Preventing Crash");
  }
}

function getKolkataTime() {
  const now = new Date();
  const options = { timeZone: "Asia/Kolkata" };
  const timeStr = now.toLocaleTimeString("en-IN", {
    ...options,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const dateStr = now
    .toLocaleDateString("en-IN", {
      ...options,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");
  return { time: timeStr, date: dateStr };
}

// ─── Middleware ───────────────────────────────────────────────────────────────
// Required for Render to not block login cookies
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "sistec-iot-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production", // auto-detect Render
      sameSite: "lax",
    },
  }),
);

function requireLogin(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ error: "Not logged in" });
  next();
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.json({ success: false, message: "All fields are required" });

  const db = readDB();
  if (db.users.find((u) => u.email === email))
    return res.json({ success: false, message: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  db.users.push({ id: Date.now(), name, email, password: hashed });
  writeDB(db);
  res.json({ success: true, message: "Registration successful" });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.json({ success: false, message: "Invalid email or password" });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email };
  res.json({ success: true, name: user.name });
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/auth/me", (req, res) => {
  res.json(
    req.session.user
      ? { loggedIn: true, user: req.session.user }
      : { loggedIn: false },
  );
});

// ─── Dashboard API Routes ─────────────────────────────────────────────────────
app.get("/api/latest", requireLogin, (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    data: db.sensors.length ? db.sensors[db.sensors.length - 1] : null,
  });
});

app.get("/api/records", requireLogin, (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.sensors });
});

app.get("/data/all", (req, res) => {
  const db = readDB();
  res.json({ success: true, count: db.sensors.length, data: db.sensors });
});

app.post("/data/predictions", (req, res) => {
  const { secret, predicted_temp, model, mae, r2, predicted_at, for_time } =
    req.body;
  if (secret !== "sistec2026")
    return res.status(403).json({ success: false, message: "FORBIDDEN" });

  const db = readDB();
  db.predictions = [
    { id: Date.now(), predicted_temp, model, mae, r2, predicted_at, for_time },
  ];
  writeDB(db);
  res.json({ success: true, message: "Prediction updated" });
});

app.get("/api/prediction/latest", requireLogin, (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    data: db.predictions && db.predictions.length ? db.predictions[0] : null,
  });
});

app.delete("/api/records/:id", requireLogin, (req, res) => {
  const db = readDB();
  db.sensors = db.sensors.filter((s) => s.id !== parseInt(req.params.id));
  writeDB(db);
  res.json({ success: true });
});

app.post("/api/lcd-text", requireLogin, (req, res) => {
  const { text } = req.body;
  if (!text || text.length > 16)
    return res.json({ success: false, message: "Text must be 1-16 chars" });

  try {
    fs.writeFileSync(LCD_FILE, text);
  } catch (e) {}
  res.json({ success: true, message: "LCD text saved" });
});

// ─── ESP8266 APIs ─────────────────────────────────────────────────────────────
app.get("/api/sensor", (req, res) => {
  const { temp, hum, key } = req.query;
  if (key !== "sistec2026") return res.status(403).send("FORBIDDEN");

  const parsedTemp = parseFloat(temp);
  const parsedHum = parseFloat(hum);
  if (isNaN(parsedTemp) || isNaN(parsedHum)) {
    return res.status(400).send("BAD REQUEST: Invalid values");
  }

  const db = readDB();
  const { time, date } = getKolkataTime();

  db.sensors.push({
    id: Date.now(),
    temperature: parsedTemp,
    humidity: parsedHum,
    time,
    date,
  });

  if (db.sensors.length > 500) db.sensors = db.sensors.slice(-500);
  writeDB(db);
  res.send("OK");
});

app.get("/api/lcd", (req, res) => {
  try {
    res.send(fs.readFileSync(LCD_FILE, "utf8"));
  } catch (e) {
    res.send("Hello SISTec!");
  }
});

// ─── Page Routes ──────────────────────────────────────────────────────────────
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html")),
);
app.get("/dashboard", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html")),
);

app.listen(PORT, () =>
  console.log(`SISTec IoT Server running on port ${PORT}`),
);
