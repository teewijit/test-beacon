// เรียกใช้งานแพ็คเกจที่จำเป็น
const express = require("express");
const app = express();
const https = require("https");

// ตั้งค่าพอร์ตและโทเค็น
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.LINE_ACCESS_TOKEN;

// ตั้งค่า middleware สำหรับการแปลง request body
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);

// เส้นทางหลักสำหรับตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่
app.get("/", (req, res) => {
  res.sendStatus(200);
});

// เส้นทางสำหรับรับ webhook จาก LINE
app.post("/webhook", async function (req, res) {
  try {
    // ส่ง response กลับทันทีเพื่อให้ LINE ไม่ต้องรอ
    res.send("HTTP POST request received!");

    console.log(req.body.events[0]);

    // ตรวจสอบว่ามี request body และเป็นข้อความ
    // if (!req.body?.events?.[0] || req.body.events[0].type !== "message") {
    //   return;
    // }

    if (!req.body?.events?.[0] || req.body.events[0].type !== "beacon") {
      return;
    }

    const event = req.body.events[0];
    const beacon = event.beacon?.type;

    // ตรวจสอบคำสั่งขอดูโปรไฟล์
    if (beacon === "enter") {
      console.log("enter");
      await handleProfileRequest(event);
    }
    // สามารถเพิ่มเงื่อนไขการตอบกลับอื่นๆ ได้ที่นี่
  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
  }
});

// ฟังก์ชันสำหรับดึงข้อมูลโปรไฟล์และส่งกลับเป็น Flex Message
async function handleProfileRequest(event) {
  const userId = event.source.userId;
  console.log("userId: ", userId);

  // สร้าง options สำหรับเรียก API ข้อมูลโปรไฟล์
  const profileOptions = {
    hostname: "api.line.me",
    path: `/v2/bot/profile/${userId}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  };

  try {
    // ดึงข้อมูลโปรไฟล์
    const profile = await fetchProfile(profileOptions);

    console.log("profile: ", profile);

    // สร้าง Flex Message
    const flexMessage = createProfileFlexMessage(event.replyToken, profile);
    console.log("flexMessage: ", flexMessage);

    // ส่งข้อความกลับไปยังผู้ใช้
    await sendLineReply(flexMessage);
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์:", error);
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลโปรไฟล์
function fetchProfile(options) {
  return new Promise((resolve, reject) => {
    const profileReq = https.request(options, (profileRes) => {
      let data = "";

      profileRes.on("data", (chunk) => {
        data += chunk;
      });

      profileRes.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    profileReq.on("error", reject);
    profileReq.end();
  });
}

// ฟังก์ชันสร้าง Flex Message สำหรับแสดงข้อมูลโปรไฟล์
function createProfileFlexMessage(replyToken, profile) {
  console.log(profile.displayName);
  return {
    replyToken: replyToken,
    messages: [
      {
        type: "flex",
        altText: "Digital Name Card",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "Digital Name Card",
                weight: "bold",
                color: "#ffffff",
                size: "xl",
                align: "center",
              },
            ],
            backgroundColor: "#00B900",
          },
          hero: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "image",
                url: profile.pictureUrl || "https://via.placeholder.com/300",
                size: "xl",
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: profile.displayName || "ไม่ระบุชื่อ",
                size: "xl",
                align: "center",
                weight: "bold",
              },
              {
                type: "text",
                text: profile.statusMessage || "ไม่มีข้อความสถานะ",
                align: "center",
              },
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "เรียกดูนัดหมาย",
                  uri: "https://liff.line.me/2006769464-EgnOXMW7",
                },
                style: "primary",
              },
            ],
          },
        },
      },
    ],
  };
}

// ฟังก์ชันสำหรับส่งข้อความตอบกลับไปยัง LINE
function sendLineReply(message) {
  return new Promise((resolve, reject) => {
    const webhookOptions = {
      hostname: "api.line.me",
      path: "/v2/bot/message/reply",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
    };

    const req = https.request(webhookOptions, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", reject);
    req.write(JSON.stringify(message));
    req.end();
  });
}

// เริ่มต้นเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`);
});
