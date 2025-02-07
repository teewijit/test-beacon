const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
app.use(express.json());

const filePath = path.join(__dirname, "events.txt");

// โหลดใบรับรอง SSL ของ Let's Encrypt
const sslOptions = {
    key: fs.readFileSync("/etc/letsencrypt/live/9net-beacon.mungkud.me/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/9net-beacon.mungkud.me/fullchain.pem")
};

// ✅ **เพิ่ม /test สำหรับตรวจสอบว่าเซิร์ฟเวอร์ทำงาน**
app.get("/test", (req, res) => {
    res.json({ status: "success", message: "🚀 Server is running!" });
});

// Webhook รับ event จาก LINE
app.post("/webhook", async function (req, res) {
  try {
    res.send("HTTP POST request received!"); // ตอบกลับทันที

    const event = req.body.events?.[0];

    if (!event) {
      return;
    }

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
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`🚀 HTTPS Server running on https://9net-beacon.mungkud.me:${PORT}`);
});
