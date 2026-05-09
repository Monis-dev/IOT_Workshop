const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());

// Tell the server to serve the frontend files
app.use(express.static(path.join(__dirname, "public")));

let tiltValue = 0;

// 1. Explicitly serve the HTML page when you open the URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 2. Phone sends Gyro data here
app.post("/update", (req, res) => {
  tiltValue = req.body.tilt;
  res.sendStatus(200);
});

// 3. ESP8266 gets Gyro data from here
app.get("/get", (req, res) => {
  res.json({ tilt: tiltValue });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Fluid Server Running!"),
);
