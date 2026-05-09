/*
 * ============================================================
 *  SISTec IoT Application 2026 — ESP8266 Arduino Code
 * ============================================================
 *  Hardware:
 *    DHT11  → D5
 *    LCD I2C → D1 (SCL), D2 (SDA), Address: 0x27
 *
 *  Libraries Required (install via Library Manager):
 *    - DHT sensor library by Adafruit
 *    - Adafruit Unified Sensor
 *    - LiquidCrystal_I2C by Frank de Brabander
 *    - ESP8266WiFi (built-in)
 *    - ESP8266HTTPClient (built-in)
 *    - WiFiClientSecureBearSSL (built-in with ESP8266 core)
 * ============================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ─── WiFi Credentials ─────────────────────────────────────
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ─── Server URL (Render HTTPS URL) ────────────────────────
// Replace with your actual Render app URL
const char* serverURL = "https://your-app-name.onrender.com";

// API Key (must match server.js)
const char* apiKey = "sistec2026";

// ─── DHT11 Setup ──────────────────────────────────────────
#define DHTPIN D5
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ─── LCD Setup ────────────────────────────────────────────
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ─── Variables ────────────────────────────────────────────
float temperature = 0;
float humidity    = 0;

// ──────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);

  // Init DHT
  dht.begin();

  // Init LCD
  Wire.begin(D2, D1);   // SDA=D2, SCL=D1
  lcd.init();
  lcd.backlight();

  // ── LCD: Connecting to WiFi ──────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CONNECTING TO");
  lcd.setCursor(0, 1);
  lcd.print("WiFi");

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  int dots = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(dots % 16, 1);
    lcd.print(".");
    dots++;
    if (dots > 16) {
      dots = 0;
      lcd.setCursor(0, 1);
      lcd.print("                ");
    }
  }

  Serial.println("\nConnected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // ── LCD: Connected ────────────────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CONNECTED TO");
  lcd.setCursor(0, 1);
  lcd.print("WiFi");
  delay(1500);

  // ── LCD: Welcome ─────────────────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("-- WELCOME --");
  lcd.setCursor(0, 1);
  lcd.print("SISTec IoT 2026");
  delay(2000);
}

// ──────────────────────────────────────────────────────────
void loop() {

  // ── Read DHT11 ───────────────────────────────────────────
  temperature = dht.readTemperature();
  humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 read failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SENSOR ERROR");
    lcd.setCursor(0, 1);
    lcd.print("Check DHT11");
    delay(2000);
    return;
  }

  Serial.print("Temp: "); Serial.print(temperature);
  Serial.print(" C | Hum: "); Serial.print(humidity);
  Serial.println(" %");

  // ── LCD: Temperature ──────────────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("TEMPERATURE");
  lcd.setCursor(0, 1);
  lcd.print(temperature, 1);
  lcd.print(" 'C");
  delay(2000);

  // ── LCD: Humidity ─────────────────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("HUMIDITY");
  lcd.setCursor(0, 1);
  lcd.print(humidity, 1);
  lcd.print(" %");
  delay(2000);

  // ── Fetch LCD Text from Server (API 2) ────────────────────
  String lcdText = fetchLCDText();

  // ── LCD: Show fetched text ────────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SISTec DISPLAY");
  lcd.setCursor(0, 1);
  // Trim to 16 chars
  if (lcdText.length() > 16) lcdText = lcdText.substring(0, 16);
  lcd.print(lcdText);
  delay(3000);

  // ── LCD: Sending data ─────────────────────────────────────
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SENDING DATA TO");
  lcd.setCursor(0, 1);
  lcd.print("WEB SERVER....");
  delay(1000);

  // ── Send data to server (API 1) ───────────────────────────
  bool sent = sendSensorData(temperature, humidity);

  // ── LCD: Result ───────────────────────────────────────────
  lcd.clear();
  if (sent) {
    lcd.setCursor(0, 0);
    lcd.print("DATA SENT...!!");
    lcd.setCursor(0, 1);
    lcd.print("SUCCESS");
  } else {
    lcd.setCursor(0, 0);
    lcd.print("SEND FAILED");
    lcd.setCursor(0, 1);
    lcd.print("Retrying next...");
  }
  delay(1000);

  // Wait before next loop (15 seconds)
  delay(15000);
}

// ──────────────────────────────────────────────────────────
// API 1: Send Temperature & Humidity to Server
// Uses HTTPS with BearSSL (fingerprint check skipped for Render)
// ──────────────────────────────────────────────────────────
bool sendSensorData(float temp, float hum) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return false;
  }

  // Build URL
  String url = String(serverURL) + "/api/sensor?temp=" + String(temp, 1)
               + "&hum=" + String(hum, 1)
               + "&key=" + String(apiKey);

  Serial.print("POST to: ");
  Serial.println(url);

  // Use BearSSL client — skip certificate verification
  // (Render uses a valid cert but fingerprint changes; setInsecure() is fine for IoT)
  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();  // Skip SSL certificate verification

  HTTPClient http;
  http.begin(*client, url);
  http.setTimeout(10000);

  int httpCode = http.GET();
  String response = http.getString();

  Serial.print("HTTP Response: ");
  Serial.println(httpCode);
  Serial.print("Body: ");
  Serial.println(response);

  http.end();

  return (httpCode == 200 && response == "OK");
}

// ──────────────────────────────────────────────────────────
// API 2: Fetch LCD text from Server
// ──────────────────────────────────────────────────────────
String fetchLCDText() {
  if (WiFi.status() != WL_CONNECTED) {
    return "No WiFi";
  }

  String url = String(serverURL) + "/api/lcd";

  Serial.print("GET: ");
  Serial.println(url);

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();

  HTTPClient http;
  http.begin(*client, url);
  http.setTimeout(8000);

  int httpCode = http.GET();
  String text = "";

  if (httpCode == 200) {
    text = http.getString();
    text.trim();
    Serial.print("LCD Text: ");
    Serial.println(text);
  } else {
    Serial.print("Fetch failed: ");
    Serial.println(httpCode);
    text = "Fetch Error";
  }

  http.end();
  return text;
}
