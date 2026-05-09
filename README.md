# SISTec IoT Application 2026

A full-stack IoT web application for monitoring Temperature & Humidity via ESP8266 + DHT11.

---

## Project Structure

```
sistec-iot/
├── server.js               ← Express backend
├── package.json
├── render.yaml             ← Render deployment config
├── db.json                 ← Auto-created on first run (JSON database)
├── lcd.txt                 ← Auto-created on first run (LCD text storage)
├── public/
│   ├── index.html          ← Login page
│   ├── register.html       ← Register page
│   └── dashboard.html      ← IoT Dashboard
└── ESP8266_SISTec_IoT.ino  ← Arduino code
```

---

## Local Setup

```bash
npm install
node server.js
# Open http://localhost:3000
```

---

## Deploy to Render

1. Push this project to a GitHub repository
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Click **Deploy**
6. Copy your Render URL (e.g. `https://sistec-iot-2026.onrender.com`)

> ⚠️ Note: Render's free tier spins down after inactivity. First request may take ~30 seconds.

---

## ESP8266 Setup

1. Open `ESP8266_SISTec_IoT.ino` in Arduino IDE
2. Install required libraries:
   - **DHT sensor library** by Adafruit
   - **Adafruit Unified Sensor**
   - **LiquidCrystal_I2C** by Frank de Brabander
3. Edit the file:
   ```cpp
   const char* ssid     = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* serverURL = "https://your-app-name.onrender.com";
   ```
4. Select board: **NodeMCU 1.0 (ESP-12E Module)**
5. Upload

---

## API Reference

### API 1 — Save Sensor Data (ESP8266 → Server)
```
GET https://your-app.onrender.com/api/sensor?temp=25.5&hum=60.2&key=sistec2026
Response: OK
```

### API 2 — Fetch LCD Text (ESP8266 ← Server)
```
GET https://your-app.onrender.com/api/lcd
Response: Hello World
```

---

## Hardware Wiring

| Component | Pin |
|-----------|-----|
| DHT11 Data | D5 |
| LCD SDA | D2 |
| LCD SCL | D1 |
| LCD VCC | 3.3V or 5V |
| LCD GND | GND |
| LCD I2C Address | 0x27 |
