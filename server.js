const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── File Paths ───────────────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');
const LCD_FILE = path.join(__dirname, 'lcd.txt');

// ─── Init DB if not exists ────────────────────────────────────────────────────
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sensors: [] }, null, 2));
}
if (!fs.existsSync(LCD_FILE)) {
  fs.writeFileSync(LCD_FILE, 'Hello SISTec!');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Get current time in Asia/Kolkata timezone
function getKolkataTime() {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata' };

  const timeStr = now.toLocaleTimeString('en-IN', {
    ...options,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const dateStr = now.toLocaleDateString('en-IN', {
    ...options,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  return { time: timeStr, date: dateStr };
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'sistec-iot-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Auth middleware
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// Register
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.email === email);
  if (existing) {
    return res.json({ success: false, message: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, 10);
  db.users.push({ id: Date.now(), name, email, password: hashed });
  writeDB(db);

  res.json({ success: true, message: 'Registration successful' });
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = readDB();

  const user = db.users.find(u => u.email === email);
  if (!user) {
    return res.json({ success: false, message: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.json({ success: false, message: 'Invalid email or password' });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email };
  res.json({ success: true, name: user.name });
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get session user
app.get('/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ─── Dashboard API Routes (require login) ─────────────────────────────────────

// Get latest sensor data
app.get('/api/latest', requireLogin, (req, res) => {
  const db = readDB();
  const sensors = db.sensors;
  if (sensors.length === 0) {
    return res.json({ success: true, data: null });
  }
  const latest = sensors[sensors.length - 1];
  res.json({ success: true, data: latest });
});

// Get all sensor records
app.get('/api/records', requireLogin, (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.sensors });
});

// Delete a sensor record
app.delete('/api/records/:id', requireLogin, (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  db.sensors = db.sensors.filter(s => s.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Save LCD text
app.post('/api/lcd-text', requireLogin, (req, res) => {
  const { text } = req.body;
  if (!text || text.length > 16) {
    return res.json({ success: false, message: 'Text must be 1-16 characters' });
  }
  fs.writeFileSync(LCD_FILE, text);
  res.json({ success: true, message: 'LCD text saved' });
});

// ─── ESP8266 APIs ─────────────────────────────────────────────────────────────

// API 1: Save Temperature & Humidity (called by ESP8266)
// Supports both GET and POST for flexibility
// GET:  /api/sensor?temp=25&hum=60&key=sistec2026
// POST: /api/sensor with JSON body
app.get('/api/sensor', (req, res) => {
  const { temp, hum, key } = req.query;

  // Simple API key check to prevent random writes
  if (key !== 'sistec2026') {
    return res.status(403).send('FORBIDDEN');
  }

  if (!temp || !hum) {
    return res.status(400).send('MISSING PARAMS');
  }

  const db = readDB();
  const { time, date } = getKolkataTime();

  const record = {
    id: Date.now(),
    temperature: parseFloat(temp),
    humidity: parseFloat(hum),
    time: time,
    date: date
  };

  db.sensors.push(record);
  // Keep only last 500 records to save space
  if (db.sensors.length > 500) {
    db.sensors = db.sensors.slice(-500);
  }
  writeDB(db);

  res.send('OK');
});

app.post('/api/sensor', (req, res) => {
  const { temp, hum, key } = req.body;

  if (key !== 'sistec2026') {
    return res.status(403).send('FORBIDDEN');
  }

  if (!temp || !hum) {
    return res.status(400).send('MISSING PARAMS');
  }

  const db = readDB();
  const { time, date } = getKolkataTime();

  const record = {
    id: Date.now(),
    temperature: parseFloat(temp),
    humidity: parseFloat(hum),
    time: time,
    date: date
  };

  db.sensors.push(record);
  if (db.sensors.length > 500) {
    db.sensors = db.sensors.slice(-500);
  }
  writeDB(db);

  res.send('OK');
});

// API 2: Fetch LCD text (called by ESP8266)
app.get('/api/lcd', (req, res) => {
  const text = fs.readFileSync(LCD_FILE, 'utf8');
  res.send(text);
});

// ─── Page Routes ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`SISTec IoT Server running on port ${PORT}`);
});
