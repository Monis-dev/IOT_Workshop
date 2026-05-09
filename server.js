const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
// Serve the frontend HTML file
app.use(express.static(path.join(__dirname, "public")));

let tiltValue = 0;

// Phone sends data here
app.post("/update", (req, res) => {
  tiltValue = req.body.tilt;
  res.sendStatus(200);
});

// ESP8266 requests data from here
app.get("/get", (req, res) => {
  res.json({ tilt: tiltValue });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Wave Server running on port ${PORT}`));
