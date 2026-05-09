const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(__dirname)); // Serves the HTML file

let tiltValue = 0;

// Phone sends Gyro data here
app.post("/update", (req, res) => {
  tiltValue = req.body.tilt;
  res.sendStatus(200);
});

// ESP8266 gets Gyro data from here
app.get("/get", (req, res) => {
  res.json({ tilt: tiltValue });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Fluid Server Running!"),
);
