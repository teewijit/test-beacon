const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json()); // รองรับ JSON body

const filePath = path.join(__dirname, "events.txt"); // กำหนด path ของไฟล์

// Webhook รับ event จาก LINE
app.post("/webhook", async function (req, res) {
  try {
    res.send("HTTP POST request received!"); // ส่ง response ทันที

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

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 25680;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
