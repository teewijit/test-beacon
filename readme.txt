
ทำ ssl ที่ port 25680
const https = require("https");
// โหลดใบรับรอง SSL ของ Let's Encrypt
const sslOptions = {
    key: fs.readFileSync("/etc/letsencrypt/live/9net-beacon.mungkud.me/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/9net-beacon.mungkud.me/fullchain.pem")
};

// เริ่มเซิร์ฟเวอร์ HTTPS
const PORT = process.env.PORT || 25680;
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(` HTTPS Server running on https://9net-beacon.mungkud.me:${PORT}`);
});




1. ใช้ PM2 (แนะนำ)
PM2 เป็น Process Manager สำหรับ Node.js ที่ช่วยให้เราสามารถ รัน, รีสตาร์ท, ดู logs และตั้งค่าให้รันอัตโนมัติหลังจากรีบูตเครื่อง ได้ง่าย

cd /mnt/volume_fr_pr1/DATA/9net-beacon

1.1 ติดตั้ง PM2
ติดตั้ง PM2 บนเซิร์ฟเวอร์:
npm install -g pm2

1.2 รัน Express ด้วย PM2
รันแอป:
pm2 start index.js --name 9net-beacon
(เปลี่ยน server.js เป็นชื่อไฟล์ของคุณ)

1.3 ตั้งให้ PM2 รันหลังจากรีบูตเครื่อง
pm2 save
pm2 startup

1.4 คำสั่งจัดการเซิร์ฟเวอร์ผ่าน PuTTY
เช็คสถานะโปรเซส
pm2 list

รีสตาร์ทเซิร์ฟเวอร์
pm2 restart 9net-beacon

หยุดเซิร์ฟเวอร์
pm2 stop 9net-beacon

ลบโปรเซสออกจาก PM2
pm2 delete 9net-beacon

ดู logs
pm2 logs

1.5 ทำให้ PM2 จัดการ SSL Certbot Auto-Renew
เพิ่ม --watch เพื่อให้ PM2 รีโหลดแอปเมื่อมีการอัปเดตไฟล์ SSL:
pm2 start index.js --name 9net-beacon --watch



