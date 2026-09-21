# Cherdpan — เชื่อม Travel Map และ Airtable

## สิ่งที่เตรียมไว้

- หน้าเว็บเดิมพร้อมแผนที่ ตัวกรองปี พ.ศ. ประเทศ/พื้นที่ และค้นหาทริป/สถานที่
- `/travel-map` แผนที่เต็มหน้า ใช้ข้อมูลชุดเดียวกับหน้าแรก
- `/api/travel` อ่าน Airtable ฝั่งเซิร์ฟเวอร์และเก็บแคช 15 นาที
- ข้อมูลสำรองจาก Airtable วันที่ 21 กันยายน 2569: 22 รายการเดินทาง, 163 สถานที่/กิจกรรม
- ดึงเฉพาะชื่อทริป ปี ประเทศ เมือง และสถานที่ ไม่มีข้อมูล Passport, VISA, Immigration, ราคา หรือกุญแจเข้าถึงในไฟล์เผยแพร่
- หมุดใช้พิกัดเมืองอ้างอิงจากโค้ดแผนที่เดิม ไม่ใช่เส้นทาง GPS; เมืองที่ไม่ทราบพิกัดยังปรากฏในรายการ
- จำนวนรายการเดินทางคือจำนวน records โดยไม่ได้ตัดสินว่า records ชื่อคล้ายกันเป็นทริปเดียวกัน

## 1. เปลี่ยนกุญแจ Airtable เดิม

แผนที่เดิมที่ travel-map-theta-plum.vercel.app มีกุญแจ Airtable ฝังใน HTML สาธารณะ
ให้เพิกถอนกุญแจเดิมที่ https://airtable.com/create/tokens และสร้างใหม่สำหรับเว็บไซต์นี้
กำหนด scope `data.records:read` และจำกัด resource เฉพาะฐาน `Travelling`
ไม่ต้องให้สิทธิ์เขียน ไม่ต้องส่งกุญแจในแชตหรือบันทึกลง GitHub
การลบกุญแจออกจากโค้ดเพียงอย่างเดียวไม่ทำให้กุญแจเดิมหมดสิทธิ์ ต้องเพิกถอนที่ Airtable

## 2. อัปโหลดโค้ด

repository: https://github.com/Cherdpanp/Cherdpan---My-Web

แตก ZIP แล้วอัปโหลดเนื้อหาภายในโฟลเดอร์ `website` ไปยังระดับแรกของ repository
ต้องเห็น `public`, `api`, `lib`, `package.json`, `vercel.json` อยู่ที่ระดับเดียวกับ README เดิม
ไม่อัปโหลด ZIP ทั้งก้อนและไม่ซ้อนโฟลเดอร์ `website` เข้าไปอีกชั้น
Commit ลง `main` จะเริ่ม deployment ใหม่
ไฟล์หน้าเว็บจริงอยู่ใน `public/index.html`; `vercel.json` กำหนด outputDirectory เป็น `public`
ไฟล์ index.html เก่าที่ระดับแรกของ repository จะไม่ถูกใช้เป็นหน้าเว็บอีก

## 3. ตั้งค่า Vercel

Project `cherdpan-my-web` → Settings → Environment Variables

| Name | Value | Environment |
|---|---|---|
| AIRTABLE_TOKEN | กุญแจใหม่จาก Airtable | Production (และ Preview หากต้องการ) |
| AIRTABLE_BASE_ID | appHeZT7AUmz2uHrw | Production (และ Preview หากต้องการ) |

เก็บ AIRTABLE_TOKEN เป็นค่า Sensitive เมื่อหน้าตั้งค่ารองรับ
ไม่ใช้ชื่อที่ขึ้นต้นด้วย NEXT_PUBLIC_ หรือ VITE_
Framework Preset: Other, Root Directory: ระดับแรก, Output Directory: public, Build Command: ว่าง
ค่าหลักอยู่ใน vercel.json แล้ว
หลังเพิ่ม/เปลี่ยน environment variables ให้ Redeploy เพื่อให้ deployment ใช้ค่าใหม่

## 4. เปลี่ยนแผนที่เดิม

โฟลเดอร์ `legacy-map-replacement` มี index.html สำหรับ repository `Cherdpanp/travel-map`
นำไฟล์นั้นทับ index.html เดิม แล้ว Commit: URL เดิมจะพาไปยังแผนที่ใหม่ของเว็บหลัก
ทำขั้นตอนนี้หลังเว็บหลัก `/travel-map` เปิดได้แล้ว
กุญแจเก่าอาจยังอยู่ในประวัติ Git และ deployment เก่า จึงต้องเพิกถอนกุญแจเดิมตามข้อ 1

## 5. ตรวจผล

1. Vercel แสดง Ready
2. https://cherdpan-my-web.vercel.app/#travel แสดงสถิติและรายการ
3. ป้ายข้อมูลต้องขึ้น `ข้อมูลจาก Airtable` เมื่ออ่านสดสำเร็จ
4. ถ้าขึ้น `ข้อมูลที่บันทึกจาก Airtable` ระบบกำลังใช้ข้อมูลสำรอง ยังไม่ยืนยันการเชื่อมต่อสด
5. `/api/travel` ต้องมี `mode: live` เมื่อสำเร็จ และไม่มีข้อมูลลับ
6. ลองปี 2567 จะพบ SCANDINAVIA; ลองคำว่า Kyoto จะพบการเดินทางที่เชื่อมกับเมืองนั้น
7. ข้อมูลสดใช้แคชประมาณ 15 นาที ไม่ใช่การอัปเดตทันทีทุกครั้งที่แก้ Airtable

## ทดสอบในเครื่อง

ใช้ Node.js 22+, `npm test`, แล้ว `npm run dev`
หากไม่มี AIRTABLE_TOKEN หน้าทดสอบจะแสดงข้อมูลสำรองพร้อมวันที่อย่างชัดเจน
ผลทดสอบ: ผ่าน 5 การทดสอบ API (แบ่งหน้า, รายการฟิลด์ที่อนุญาต, ปี พ.ศ., แคช, ข้อมูลสำรองและการป้องกันข้อมูลลับในข้อความผิดพลาด)
ตรวจ syntax JavaScript และไฟล์อ้างอิงใน HTML แล้ว
ยังไม่ได้ยืนยันภาพหน้าจอใน browser เนื่องจากสภาพแวดล้อมทดสอบดาวน์โหลด browser ไม่สำเร็จ
ยังไม่ได้ทดสอบกับกุญแจใหม่หรือเผยแพร่จริงจนกว่าจะเชื่อม GitHub/Vercel และตั้งค่ากุญแจ

อ้างอิง:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/environment-variables
- https://support.airtable.com/articles/9934989703-creating-personal-access-tokens
- https://support.airtable.com/articles/7735693959-managing-api-call-limits-in-airtable
