const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
app.use(express.json()); // รองรับ JSON body

const filePath = path.join(__dirname, "events.txt");

// โหลด SSL Certificate และ Key
const options = {
  key: fs.readFileSync("/path/to/your/private-key.key"), // 🔹 ใส่ path ไฟล์ key
  cert: fs.readFileSync("/path/to/your/certificate.crt"), // 🔹 ใส่ path ไฟล์ certificate
};

// Webhook รับ event จาก LINE
app.post("/webhook", async function (req, res) {
  console.log(req.body);

  try {
    res.send("HTTP POST request received!");

    const event = req.body;
    if (!event) return;

    console.log("Received Event:", event);

    // บันทึก event ลงไฟล์
    fs.appendFile(filePath, JSON.stringify(event, null, 2) + "\n\n", (err) => {
      if (err) {
        console.error("Error writing to file:", err);
      }
    });

  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
  }
});

// แสดงเนื้อหาไฟล์ผ่าน API
app.get("/", (req, res) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading file");
    }
    res.type("text/plain").send(data || "No events logged yet.");
  });
});

// เริ่มเซิร์ฟเวอร์ HTTPS
const PORT = process.env.PORT || 25680;
https.createServer(options, app).listen(PORT, () => {
  console.log(`🚀 HTTPS Server running on port ${PORT}`);
});
