const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https");
const moment = require('moment');
const schedule = require('node-schedule');

const app = express();
app.use(express.json());

const filePath = path.join(__dirname, "events.txt");
const filePath_campaign = path.join(__dirname, "campaign.txt");

const _token = "Fsyb6SfP42tAxgljMbFGiZtGPuJBxcmRYHgsFFWrm8SYuaiWcXKas+Y3P8ZugasaH8sSphm0BVFdWukuaqbXTkhfD7OgEeNe7rp95xzhl/Tsh4+Ct1kegwvCe8723DjPpd0L3ay3nuxucJEyyMb0wgdB04t89/1O/w1cDnyilFU="

// ตัวแปรที่เก็บ jobs ที่กำลังทำงานอยู่
const activeJobs = new Map();

// โหลดใบรับรอง SSL ของ Let's Encrypt
const sslOptions = {
  key: fs.readFileSync("/etc/letsencrypt/live/9net-beacon.mungkud.me/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/9net-beacon.mungkud.me/fullchain.pem")
};

// ฟังก์ชันสำหรับสร้าง UUID แบบง่ายๆ
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0; // สุ่มเลข 0-15
    const v = c === 'x' ? r : (r & 0x3 | 0x8); // ทำให้เป็นรูปแบบของ UUID
    return v.toString(16);
  });
}

// ✅ **เพิ่ม /test สำหรับตรวจสอบว่าเซิร์ฟเวอร์ทำงาน**
app.get("/test", (req, res) => {
  res.json({ status: "success", message: "🚀 Server is running!" });
});

// เสิร์ฟ index.html เมื่อเปิดหน้าเว็บ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// เสิร์ฟ campaign เมื่อเปิด /campaign
app.get("/campaign", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form", "index.html"));
});

// รับ id มาแก้ไข campaign และเปิดหน้า campaign
app.get("/campaign/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form", "index.html"));
});

// ดึงข้อมูล campaign ทั้งหมด
app.get("/api/campaign", (req, res) => {
  fs.readFile(filePath_campaign, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error reading file" });
    }

    try {
      const campaign = data
        .split('\n\n')
        .filter(text => text.trim())
        .map(text => JSON.parse(text))
        .reverse();

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Error parsing campaign data" });
    }
  });
});

// ดึงข้อมูล campaign ตาม id
app.get('/api/campaign/:id', (req, res) => {
  const campaignId = req.params.id;

  fs.readFile(filePath_campaign, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error reading file" });
    }

    try {
      const campaigns = data
        .split('\n\n')
        .filter(text => text.trim())
        .map(text => JSON.parse(text));

      const campaign = campaigns.find(campaign => campaign.id === campaignId);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Error parsing campaign data" });
    }
  });
});

// บันทึก/แก้ไข campaign
app.post("/campaign.save", async function (req, res) {
  try {
    const data = req.body;

    // ตรวจสอบว่า data หรือ id ไม่มี
    if (!data || !data.id) {
      return res.status(400).send("Missing id in request body");
    }

    const campaignId = data.id;

    // อ่านข้อมูลจากไฟล์
    fs.readFile(filePath_campaign, "utf8", (err, fileData) => {
      if (err) {
        return res.status(500).send("Error reading file");
      }

      let campaigns = [];
      if (fileData.trim()) {
        try {
          campaigns = fileData
            .split('\n\n')
            .filter((text) => text.trim())
            .map((text) => JSON.parse(text));
        } catch (parseError) {
          return res.status(500).send("Error parsing file data");
        }
      }

      // ค้นหา campaign ที่มี id ตรงกับ id ที่ส่งมา
      const existingCampaignIndex = campaigns.findIndex(
        (campaign) => campaign.id === campaignId
      );

      let updatedCampaign = null;
      if (existingCampaignIndex !== -1) {
        // ถ้าพบ campaign ที่มี id ตรงกัน ให้ทำการแก้ไขข้อมูล
        const oldCampaign = campaigns[existingCampaignIndex];
        updatedCampaign = { ...oldCampaign, ...data };
        campaigns[existingCampaignIndex] = updatedCampaign;
      } else {
        // ถ้าไม่พบ campaign ที่มี id ตรงกัน ให้เพิ่มข้อมูลใหม่
        updatedCampaign = data;
        campaigns.push(updatedCampaign);
      }

      // บันทึกข้อมูลที่อัพเดตกลับไปที่ไฟล์
      fs.writeFile(filePath_campaign, campaigns.map(campaign => JSON.stringify(campaign, null, 2)).join("\n\n"), (writeErr) => {
        if (writeErr) {
          return res.status(500).send("Error writing to file");
        }

        // หลังจากบันทึกข้อมูลเรียบร้อยแล้ว ให้อัพเดต job ที่กำลังทำงานอยู่
        updateCampaignJobs(updatedCampaign);

        res.send("Data saved successfully");
      });
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาด:", error);
    res.status(500).send("Internal server error");
  }
});

// ฟังก์ชันสำหรับอัพเดต jobs ที่กำลังทำงานอยู่
function updateCampaignJobs(updatedCampaign) {
  try {
    const campaignId = updatedCampaign.id;
    const currentTime = moment();

    // คำนวณเวลาเริ่มต้นและสิ้นสุดของแคมเปญ
    const startDateTime = moment(`${updatedCampaign.d_start} ${updatedCampaign.d_start_time}`, 'YYYY-MM-DD HH:mm');
    const endDateTime = moment(`${updatedCampaign.d_end} ${updatedCampaign.d_end_time}`, 'YYYY-MM-DD HH:mm');

    // ตรวจสอบว่าแคมเปญยัง active หรือไม่
    const isActive = updatedCampaign.e_status === 'active' &&
      currentTime.isBetween(startDateTime, endDateTime, null, '[]');

    console.log(`กำลังอัพเดต jobs สำหรับแคมเปญ ${campaignId}, สถานะ: ${isActive ? 'active' : 'inactive'}`);

    // หา jobs ที่เกี่ยวข้องกับแคมเปญนี้
    const relatedJobKeys = [];
    for (const [jobKey, job] of activeJobs.entries()) {
      if (jobKey.endsWith(`-${campaignId}`)) {
        relatedJobKeys.push(jobKey);
      }
    }

    // แคมเปญ inactive หรือหมดเวลา ให้ยกเลิก jobs ทั้งหมด
    if (!isActive) {
      relatedJobKeys.forEach(jobKey => {
        const job = activeJobs.get(jobKey);
        if (job) {
          console.log(`ยกเลิก job ${jobKey} เนื่องจากแคมเปญไม่ active หรือหมดเวลา`);
          job.cancel();
          activeJobs.delete(jobKey);
        }
      });
      return;
    }

    // แคมเปญยัง active อยู่ ให้อัพเดต jobs
    const intervalMinutes = parseInt(updatedCampaign.c_seq);
    if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
      console.error(`ความถี่ไม่ถูกต้องสำหรับแคมเปญ ${campaignId}`);
      return;
    }

    // สำหรับ jobs ที่มีอยู่แล้ว ให้ยกเลิกและสร้างใหม่ด้วยความถี่ใหม่
    relatedJobKeys.forEach(jobKey => {
      const [userId] = jobKey.split('-');

      // ยกเลิก job เดิม
      const oldJob = activeJobs.get(jobKey);
      if (oldJob) {
        console.log(`ยกเลิก job ${jobKey} เพื่อสร้างใหม่ด้วยความถี่ ${intervalMinutes} นาที`);
        oldJob.cancel();
        activeJobs.delete(jobKey);
      }

      // สร้าง job ใหม่
      const newJob = schedule.scheduleJob(`*/${intervalMinutes} * * * *`, function () {
        const now = moment();

        // ตรวจสอบว่าเกินเวลาสิ้นสุดหรือไม่
        if (now.isSameOrAfter(endDateTime)) {
          console.log(`แคมเปญ ${campaignId} หมดเวลาแล้ว, ยกเลิก job`);
          newJob.cancel();
          activeJobs.delete(jobKey);
          return;
        }

        // ส่งข้อความ
        sendCampaignMessage(userId, updatedCampaign);
      });

      // เก็บ job ใหม่ไว้ใน map
      activeJobs.set(jobKey, newJob);
    });

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการอัพเดต jobs:", error);
  }
}

// ลบข้อมูล campaign ตาม id
app.get('/api/campaign/del/:id', (req, res) => {
  const campaignId = req.params.id;

  fs.readFile(filePath_campaign, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error reading file" });
    }

    try {
      // แปลงข้อมูลจากไฟล์เป็น array
      const campaigns = data
        .split('\n\n')
        .filter(text => text.trim())
        .map(text => JSON.parse(text));

      // ค้นหาข้อมูล campaign ที่ตรงกับ campaignId
      const campaignIndex = campaigns.findIndex(campaign => campaign.id === campaignId);

      if (campaignIndex === -1) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // ลบ campaign ออกจาก array
      campaigns.splice(campaignIndex, 1);

      // เขียนข้อมูลที่อัพเดตกลับไปยังไฟล์
      fs.writeFile(filePath_campaign, campaigns.map(campaign => JSON.stringify(campaign, null, 2)).join("\n\n"), (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: "Error writing to file" });
        }

        res.json({ message: "Campaign deleted successfully" });
      });

    } catch (error) {
      res.status(500).json({ error: "Error parsing campaign data" });
    }
  });
});

// Webhook รับ event จาก LINE
app.post("/webhook", async function (req, res) {
  try {
    const event = req.body.events?.[0];

    if (!event) {
      return res.status(400).send("ไม่มีข้อมูล event");
    }

    // สร้าง UUID และ timestamp
    const eventInput = {
      ...event,
      uuid: generateUUID(),
      timestamp: moment().format(),
    };

    // บันทึก event ลงไฟล์
    fs.appendFile(filePath, JSON.stringify(eventInput, null, 2) + "\n\n", (err) => {
      if (err) {
        console.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล: ", err);
        return res.status(500).send("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    });

    // ตรวจสอบแคมเปญที่กำลัง active และอยู่ในช่วงเวลา
    await setupCampaignSchedules(eventInput);

    res.status(200).send(eventInput);

  } catch (error) {
    console.error("เกิดข้อผิดพลาด: ", error);
    res.status(500).send("เกิดข้อผิดพลาด");
  }
});

// ฟังก์ชันสำหรับดึงข้อมูล campaign ทั้งหมด
async function getCampaigns() {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath_campaign, "utf8", (err, data) => {
      if (err) {
        return reject("Error reading file");
      }

      try {
        const campaigns = data
          .split('\n\n')
          .filter(text => text.trim())
          .map(text => JSON.parse(text));

        resolve(campaigns);
      } catch (error) {
        reject("Error parsing campaign data");
      }
    });
  });
}

// ฟังก์ชันเพื่อตั้งค่า schedules สำหรับแคมเปญที่ active และที่ใกล้จะมาถึง
async function setupCampaignSchedules(eventInput) {
  try {
    const campaigns = await getCampaigns();
    const userId = eventInput.source?.userId;

    if (!userId) {
      console.error("ไม่พบ userId ในข้อมูล event");
      return;
    }

    const currentTime = moment();

    // กรองแคมเปญทั้งที่ active อยู่แล้ว และที่กำลังจะเริ่มในอนาคตอันใกล้ (ภายใน 24 ชั่วโมงข้างหน้า)
    const relevantCampaigns = campaigns.filter(campaign => {
      if (campaign.e_status !== 'active') return false;

      const startDateTime = moment(`${campaign.d_start} ${campaign.d_start_time}`, 'YYYY-MM-DD HH:mm');
      const endDateTime = moment(`${campaign.d_end} ${campaign.d_end_time}`, 'YYYY-MM-DD HH:mm');

      // รวมแคมเปญที่กำลังทำงานอยู่ตอนนี้
      const isActive = currentTime.isBetween(startDateTime, endDateTime, null, '[]');

      // รวมแคมเปญที่กำลังจะเริ่มในอนาคตอันใกล้ (ภายใน 24 ชั่วโมง)
      const isUpcoming = startDateTime.isSameOrAfter(currentTime) &&
        endDateTime.isSameOrAfter(currentTime);

      return isActive || isUpcoming;
    });

    const activeCampaigns = relevantCampaigns.filter(campaign => {
      const startDateTime = moment(`${campaign.d_start} ${campaign.d_start_time}`, 'YYYY-MM-DD HH:mm');
      const endDateTime = moment(`${campaign.d_end} ${campaign.d_end_time}`, 'YYYY-MM-DD HH:mm');
      return currentTime.isBetween(startDateTime, endDateTime, null, '[]');
    });

    const upcomingCampaigns = relevantCampaigns.filter(campaign => {
      const startDateTime = moment(`${campaign.d_start} ${campaign.d_start_time}`, 'YYYY-MM-DD HH:mm');
      const endDateTime = moment(`${campaign.d_end} ${campaign.d_end_time}`, 'YYYY-MM-DD HH:mm');

      return startDateTime.isSameOrAfter(currentTime) &&  // เริ่มต้นในอนาคต
        endDateTime.isSameOrAfter(currentTime);     // ยังไม่หมดเวลา
    });


    console.log(`พบ ${activeCampaigns.length} แคมเปญที่ active และ ${upcomingCampaigns.length} แคมเปญที่กำลังจะเริ่มในอนาคต`);

    // ตั้งค่า schedule สำหรับแคมเปญที่กำลัง active
    for (const campaign of activeCampaigns) {
      setupActiveCampaignJob(userId, campaign);
    }

    // ตั้งค่า schedule สำหรับแคมเปญที่กำลังจะเริ่มในอนาคต
    for (const campaign of upcomingCampaigns) {
      setupUpcomingCampaignJob(userId, campaign);
    }

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการตั้งค่า schedules:", error);
  }
}

// ฟังก์ชันเพื่อตั้งค่า job สำหรับแคมเปญที่กำลัง active
function setupActiveCampaignJob(userId, campaign) {
  const jobKey = `${userId}-${campaign.id}`;

  // ตรวจสอบว่ามี job ทำงานอยู่แล้วหรือไม่
  if (activeJobs.has(jobKey)) {
    console.log(`มี job สำหรับ ${jobKey} ทำงานอยู่แล้ว, ข้ามการตั้งค่าใหม่`);
    return;
  }

  // กำหนดเวลาสิ้นสุดแคมเปญ
  const endDateTime = moment(`${campaign.d_end} ${campaign.d_end_time}`, 'YYYY-MM-DD HH:mm');

  // คำนวณความถี่ในการส่งข้อความ (c_seq เป็นหน่วยนาที)
  const intervalMinutes = parseInt(campaign.c_seq);

  if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
    console.error(`ความถี่ไม่ถูกต้องสำหรับแคมเปญ ${campaign.id}`);
    return;
  }

  console.log(`กำลังตั้งค่า job สำหรับแคมเปญ ${campaign.id} ทุก ${intervalMinutes} นาที`);

  // ตั้งค่า job ให้ทำงานตามความถี่
  const job = schedule.scheduleJob(`*/${intervalMinutes} * * * *`, function () {
    const now = moment();

    // ตรวจสอบว่าเกินเวลาสิ้นสุดหรือไม่
    if (now.isSameOrAfter(endDateTime)) {
      console.log(`แคมเปญ ${campaign.id} หมดเวลาแล้ว, ยกเลิก job`);
      job.cancel();
      activeJobs.delete(jobKey);
      return;
    }

    // ส่งข้อความ
    sendMessageToLine(userId, campaign.c_data);
  });

  // เก็บ job ไว้ใน map
  activeJobs.set(jobKey, job);

  // ส่งข้อความแรกทันที
  sendMessageToLine(userId, campaign.c_data);
}

// ฟังก์ชันเพื่อตั้งค่า job สำหรับแคมเปญที่กำลังจะเริ่มในอนาคต
function setupUpcomingCampaignJob(userId, campaign) {
  const startJobKey = `start-${userId}-${campaign.id}`;

  // ตรวจสอบว่ามี job สำหรับการเริ่มต้นแคมเปญอยู่แล้วหรือไม่
  if (activeJobs.has(startJobKey)) {
    console.log(`มี job สำหรับการเริ่มต้นแคมเปญ ${startJobKey} ทำงานอยู่แล้ว, ข้ามการตั้งค่าใหม่`);
    return;
  }

  // กำหนดเวลาเริ่มต้นแคมเปญ
  const startDateTime = moment(`${campaign.d_start} ${campaign.d_start_time}`, 'YYYY-MM-DD HH:mm');

  console.log(`กำลังตั้งค่า job เพื่อรอเริ่มแคมเปญ ${campaign.id} ในเวลา ${startDateTime.format('YYYY-MM-DD HH:mm')}`);

  // ตั้งค่า job เพื่อรอถึงเวลาเริ่มต้นแคมเปญ
  const startJob = schedule.scheduleJob(startDateTime.toDate(), function () {
    console.log(`ถึงเวลาเริ่มแคมเปญ ${campaign.id} แล้ว, กำลังตั้งค่า job สำหรับการส่งข้อความ`);

    // ยกเลิก job สำหรับการรอเริ่มต้นแคมเปญ
    startJob.cancel();
    activeJobs.delete(startJobKey);

    // ตั้งค่า job สำหรับการส่งข้อความเมื่อถึงเวลาเริ่มต้นแคมเปญ
    setupActiveCampaignJob(userId, campaign);
  });

  // เก็บ job สำหรับการรอเริ่มต้นแคมเปญไว้ใน map
  activeJobs.set(startJobKey, startJob);
}

// ตรวจสอบและยกเลิก jobs ที่หมดอายุทุกชั่วโมง
schedule.scheduleJob('0 * * * *', async function () {
  console.log('กำลังตรวจสอบ jobs ที่หมดอายุ...');

  const currentTime = moment();
  const campaigns = await getCampaigns();

  for (const [jobKey, job] of activeJobs.entries()) {
    const [userId, campaignId] = jobKey.split('-');
    const campaign = campaigns.find(c => c.id === campaignId);

    if (!campaign || campaign.e_status !== 'active') {
      console.log(`แคมเปญ ${campaignId} ไม่ active แล้ว, ยกเลิก job`);
      job.cancel();
      activeJobs.delete(jobKey);
      continue;
    }

    const endDateTime = moment(`${campaign.d_end} ${campaign.d_end_time}`, 'YYYY-MM-DD HH:mm');

    if (currentTime.isSameOrAfter(endDateTime)) {
      console.log(`แคมเปญ ${campaignId} หมดเวลาแล้ว, ยกเลิก job`);
      job.cancel();
      activeJobs.delete(jobKey);
    }
  }
});

// ฟังก์ชันในการส่งข้อความไปยัง LINE API
async function sendMessageToLine(userId, message) {
  if (!userId || userId.trim() === '') {
    console.error("Error: userId is missing or empty");
    return;
  }

  const channelAccessToken = _token; // ใส่ Channel Access Token ที่คุณได้จาก LINE Developers
  console.log('Message:', message);

  const data = JSON.stringify({
    to: userId,
    messages: [
      {
        type: 'text',
        text: message
      }
    ]
  });

  const options = {
    hostname: 'api.line.me',
    path: '/v2/bot/message/push',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`
    }
  };

  // ส่งคำขอไปยัง LINE API
  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e);
  });

  // เขียนข้อมูลไปยัง request
  req.write(data);

  // ส่งคำขอ
  req.end();
}

// ฟังก์ชันสำหรับดึงข้อมูล campaign ทั้งหมด
async function getCampaigns() {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath_campaign, "utf8", (err, data) => {
      if (err) {
        return reject("Error reading file");
      }

      try {
        const campaigns = data
          .split('\n\n')
          .filter(text => text.trim())
          .map(text => JSON.parse(text));

        resolve(campaigns);
      } catch (error) {
        reject("Error parsing campaign data");
      }
    });
  });
}

// API endpoint สำหรับดึงข้อมูล events
app.get("/api/events", (req, res) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error reading file" });
    }

    try {
      // แปลงข้อความเป็น array ของ objects
      const events = data
        .split('\n\n')
        .filter(text => text.trim())
        .map(text => JSON.parse(text))
        .reverse(); // เรียงจากใหม่ไปเก่า

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Error parsing events data" });
    }
  });
});

// เริ่มเซิร์ฟเวอร์ HTTPS
const PORT = process.env.PORT || 25680;
https.createServer(sslOptions, app).listen(PORT, () => {
// app.listen(PORT, () => {
  console.log(`🚀 HTTPS Server running on https://9net-beacon.mungkud.me:${PORT}`);
});
