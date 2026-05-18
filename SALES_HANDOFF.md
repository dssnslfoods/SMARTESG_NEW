# Sales Handoff — ESG Smart Performance

> **Purpose:** เอกสารสำหรับใช้จัดทำ presentation นำเสนอขายระบบให้กับลูกค้าองค์กร
> **Audience:** Sales / Pre-sales / Marketing team
> **Product:** ESG Smart Performance v2.6 — Climate Action Platform
> **Owner:** D2Infinite Co.,Ltd.

---

## 1. Elevator Pitch (30 วินาที)

> **"ESG Smart Performance คือ SaaS Platform ที่ทำให้องค์กรของคุณบันทึก ติดตาม และรายงานตัวชี้วัด ESG (Environmental, Social, Governance) ได้ครบวงจรในที่เดียว — เปลี่ยนงาน reporting ที่กินเวลา 2 สัปดาห์ให้เหลือ 2 ชั่วโมง พร้อม audit trail ที่ผู้สอบบัญชียอมรับ และพร้อมส่งออกตามมาตรฐาน GRI / SET / TCFD"**

### ประโยคเดียวสำหรับ Decision Maker

- **CEO / CFO:** *"ลดต้นทุนการทำรายงานความยั่งยืน 70% พร้อมข้อมูลพร้อมตอบนักลงทุนและ regulator ตลอดเวลา"*
- **CSR / Sustainability Manager:** *"ทำงานน้อยลง แต่รายงานออกได้บ่อยขึ้น มีตัวเลขสนับสนุนการตัดสินใจ"*
- **IT Director:** *"Cloud-native, RLS-secured, ไม่ต้องดูแล server, scale ได้ตามจำนวน user"*

---

## 2. ปัญหาที่ตลาดกำลังเผชิญ (Why Now?)

### 🌡️ Climate Regulation กดดันขึ้นเรื่อยๆ

- **SET (ตลาดหลักทรัพย์):** บังคับรายงาน One Report + ESG disclosure ตั้งแต่ปี 2022
- **EU CSRD:** มีผลบังคับ supply chain ในไทยที่ส่งออก EU ตั้งแต่ปี 2025
- **TCFD / IFRS S1-S2:** มาตรฐานใหม่ที่นักลงทุนเริ่มถาม
- **Carbon Border Adjustment Mechanism (CBAM):** ผู้ส่งออก EU ต้องรายงาน carbon footprint

### 😩 Pain Points ของลูกค้าทั่วไป

| Pain | สถานการณ์จริง |
|---|---|
| ❌ ใช้ **Excel** ส่งกันหลายฉบับ | Sheet หาย, สูตรเพี้ยน, version ไม่ตรง |
| ❌ ข้อมูลกระจัดกระจาย | คนละโรงงาน คนละ format ต้องไล่รวม |
| ❌ ไม่มี audit trail | ผู้สอบบัญชีถามว่า "ใครแก้?" ตอบไม่ได้ |
| ❌ ทำรายงาน 1 ครั้ง/ปี | ผู้บริหารอยากเห็น real-time แต่ทำไม่ได้ |
| ❌ ไม่รู้เปรียบเทียบกับคู่แข่ง | benchmark ไม่ได้ |
| ❌ ใช้คนเยอะ | CSR team 5 คน ทำเต็มเวลา 2 เดือน |

---

## 3. Solution Overview (เรา solve อะไรได้บ้าง)

### Core Features

| Feature | ลูกค้าได้อะไร |
|---|---|
| 🗂️ **Multi-site / Multi-company** | บริษัทในเครือ 5+ บริษัท, สาขา 10+ แห่ง รวมในที่เดียว |
| 📝 **Data Entry แบบ Structured** | บันทึก metric ตาม template มาตรฐาน — ไม่มี free text หลง |
| ⚡ **Real-time Dashboard** | KPI cards + charts อัปเดตทันทีที่บันทึก |
| 🔒 **Role-based Access (5 roles)** | Admin / Executive / Supervisor / Staff / Guest — แยกสิทธิ์ชัดเจน |
| 📊 **Reports 4 มิติ** | Environmental, Social, Governance + ESG Overview |
| 🔍 **Audit Log** | ทุกการเปลี่ยนแปลงบันทึกพร้อม before/after — ผ่าน SOX/ISO ได้ |
| 🌐 **Bilingual (TH/EN)** | Toggle ภาษาได้ทุกหน้า |
| ✉️ **Custom Email Templates** | Password reset, notification ด้วย brand ของลูกค้า |
| 💾 **Backup / Restore** | Export ทั้ง database ได้, restore ได้ |
| 📱 **Responsive** | ใช้ได้ทั้ง desktop + mobile |

### Architecture Strengths

- **Serverless** — ไม่มี server ให้ดูแล (Supabase + Firebase Hosting)
- **Tokyo region** — latency ต่ำสำหรับลูกค้าในไทย/อาเซียน
- **PostgreSQL 15** — ฐานข้อมูล enterprise-grade
- **RLS Security** — Row-level security ทุก table
- **API-first** — เชื่อม BI tool / ERP ภายนอกได้ผ่าน REST API
- **Edge Functions** — รองรับการสร้าง business logic เฉพาะลูกค้าได้

---

## 4. Differentiators — ทำไมต้องเลือกเรา

### vs. Excel / Google Sheets

| | Excel | ESG Smart Performance |
|---|---|---|
| Multi-user real-time | ❌ | ✅ |
| Audit log | ❌ | ✅ |
| Role-based access | ❌ | ✅ |
| Validation | จำกัด | ครบ + customizable |
| Reports auto-gen | ต้องทำเอง | คลิกเดียว |
| Backup | ต้องจำเซฟ | อัตโนมัติ |

### vs. International Software (เช่น SAP, Workiva, Sphera)

| | Foreign SaaS | ESG Smart Performance |
|---|---|---|
| ราคา/ปี | 2-10 ล้าน บาท | **เริ่มต้น 1/10 ของราคาต่างประเทศ** |
| Implementation | 6-12 เดือน | **2-4 สัปดาห์** |
| ภาษาไทย | ไม่มี / แปลแบบทื่อ | **ภาษาไทย native** |
| Customize | ต้องจ้าง partner | **ทีมไทย ตอบเร็ว** |
| มาตรฐานไทย (SET, ก.ล.ต.) | ไม่ครอบคลุม | **ออกแบบให้ไทย** |

### vs. Custom Build เอง

- **ประหยัด 70-80%** เทียบกับจ้างทีม dev สร้างเองตั้งแต่ 0
- พร้อมใช้ทันที vs รอ 6-12 เดือน
- ทีม D2Infinite ดูแลต่อเนื่อง — ไม่ต้องเลี้ยง dev in-house

---

## 5. Target Customer / ICP (Ideal Customer Profile)

### 🎯 Primary

- **บริษัทมหาชน (SET-listed)** ที่ต้องทำ One Report
- **บริษัทในเครือ Conglomerate** ที่มีหลายบริษัท หลายโรงงาน
- **อุตสาหกรรม High-impact:** อาหาร, พลังงาน, เคมี, ก่อสร้าง, แฟชั่น, transport, อสังหา

### 🎯 Secondary

- **บริษัทส่งออก EU/US** ที่โดน CBAM / Scope 3 disclosure
- **บริษัทขนาดกลางที่กำลังเข้าตลาด IPO**
- **กลุ่ม SME ที่ supply chain ของบริษัทใหญ่** (ต้องตอบ ESG questionnaire)

### 🚫 Not a Fit (Disqualify)

- บริษัทที่ยังไม่มี ESG policy เลย — ขายไม่ทัน
- องค์กรที่ไม่ใช้ cloud (มี requirement on-premise)
- บริษัทเล็กมาก (< 10 คน) — ใช้ Excel ก็พอ

---

## 6. Sales Stories & Use Cases

### 📖 Case Study Template — NSL Foods PCL

> **Profile:** Public food manufacturer, **5 บริษัทในเครือ, 10 สาขา/โรงงาน, 21 users**
> **Before:** ใช้ Excel ส่งกัน 5 sheet/เดือน, CSR team ต้องไล่ทวงข้อมูล 2 สัปดาห์
> **After (with ESG Smart Performance):**
> - บันทึก metric **2,172 records** ตลอด 1 ปีในระบบเดียว
> - Audit log **3,390 entries** ผ่าน auditor ได้ทันที
> - รายงาน ESG ออกได้ทุกเดือน vs เคยทำเพียงปีละครั้ง
> - ลดเวลาจาก **2 สัปดาห์ → 2 วัน** (ลด 86%)

### 💬 Talking Points สำหรับ Demo

**Scene 1 — Login + Migration Banner**
> *"ระบบของเราออกแบบให้ลูกค้ารู้สึก 'พร้อม' กับยุค climate action — ดูจากหน้า login จะเห็น theme 'Combat Global Warming' ซึ่งสะท้อน mission ของลูกค้าทันที"*

**Scene 2 — Dashboard**
> *"ผู้บริหารเปิดเข้ามาเห็น KPI ทันที — ไม่ต้องรอ CSR ทำสไลด์"*

**Scene 3 — Data Entry**
> *"Staff ที่โรงงานบันทึกค่าน้ำ ค่าไฟ ใช้เวลา 30 วินาทีต่อตัวชี้วัด — ระบบล็อก Metric/Site/Period ไม่ให้แก้พลาด"*

**Scene 4 — Audit Log**
> *"ผู้สอบบัญชีถาม 'ใครแก้ค่านี้ตอนไหน?' — เราตอบในคลิกเดียว พร้อม before/after"*

**Scene 5 — Reports**
> *"แสดงรายงาน E / S / G แยกมิติ พร้อม export (กำลังพัฒนาเพิ่ม PDF Export ใน Q2)"*

---

## 7. ROI / Business Impact (ตัวเลขสำหรับใส่สไลด์)

### ⏱️ ลดเวลา

- งาน data entry: ลด **40-60%** (จาก typing เปล่า → form-based + validation)
- รายงานรายเดือน: ลด **80-90%** (auto-aggregate vs ทำเอง)
- Audit prep: ลด **95%** (audit log พร้อมใช้ vs ต้องไล่ค้น email)

### 💰 ประหยัดต้นทุน

- ลด CSR headcount ที่ต้องทำงาน manual **1-2 FTE/ปี** = **0.7-2 ล้านบาท/ปี**
- ลด consulting cost ในการทำรายงาน **30-50%**
- หลีกเลี่ยงค่าปรับ regulator จากการ report ไม่ทันเวลา

### 📈 เพิ่มมูลค่า

- ESG rating ดีขึ้น → ดอกเบี้ยกู้ถูกลง (ESG-linked loan)
- Investor confidence → P/E ratio สูงขึ้น
- พร้อมตอบ CBAM / EU regulation → supply chain ไม่หลุด

---

## 8. Pricing Strategy (Suggested — Confirm กับ D2Infinite)

| Tier | เป้าหมาย | Features | ราคา (บาท/เดือน) |
|---|---|---|---|
| **Starter** | 1 บริษัท, < 5 sites, < 10 users | Core features | 15,000 - 25,000 |
| **Business** | < 5 บริษัท, < 20 sites, < 50 users | + Custom reports + API | 50,000 - 80,000 |
| **Enterprise** | Unlimited + SLA + On-premise | + Dedicated support + SSO | 150,000+ |

**Add-ons:**
- Implementation & training: 100,000 - 500,000 บาท (one-time)
- Custom integration (ERP, BI): 200,000+
- AI features (OCR, anomaly detection): 50,000/เดือน

---

## 9. Demo Flow (สำหรับ Sales Pitch ~ 20 นาที)

### นาที 0-3: Hook
- เริ่มด้วยถามคำถาม: *"ปีที่แล้วทีมคุณใช้เวลาทำรายงาน sustainability กี่วัน?"*
- เปิดสถิติ: SET-listed บริษัท > 800 รายต้องทำ ESG report
- ตั้งโจทย์: pain ทั้ง 6 ข้อ

### นาที 3-5: Solution Tease
- 1 สไลด์ overview architecture
- Highlight 3 differentiator: ภาษาไทย, ราคาเข้าถึงได้, audit-ready

### นาที 5-15: Live Demo (10 นาทีหลัก)
- Login → Dashboard (1 นาที)
- Data Entry → บันทึก 1 metric + show audit log (3 นาที)
- Reports → E/S/G (3 นาที)
- User Management → role-based (2 นาที)
- Backup & Settings (1 นาที)

### นาที 15-18: Customer Story
- เล่า NSL Foods case (ตัวเลขจริง)

### นาที 18-20: Pricing + Next Step
- เสนอ pricing tier
- Call to action: **"ขอ Pilot 30 วัน — เรา migrate ข้อมูล 1 site ให้ฟรี"**

---

## 10. FAQ / Objection Handling

| Objection | Response |
|---|---|
| *"ราคาแพง"* | เทียบกับจ้างทีม dev สร้างเอง (6 ล้าน+) หรือ Workiva (8 ล้าน+) — เราคุ้มกว่ามาก |
| *"กลัวข้อมูลรั่ว"* | Supabase (SOC 2 Type II), RLS, encrypted at rest + in transit, audit log — ปลอดภัยกว่า Excel ที่ส่งใน LINE |
| *"ระบบไทยเชื่อใจได้ไหม"* | D2Infinite ทำ enterprise system 10+ ปี, มี case study NSL Foods, support ทีมไทย 24x7 |
| *"ของเก่าใน Excel เยอะมาก"* | เรามี Bulk Import (Excel/CSV) + ทีม Implementation พา migrate ให้ |
| *"ต้อง customize เยอะ"* | Edge Functions + API-first → ลูกค้า customize หรือเชื่อม ERP ได้ |
| *"ขอ on-premise"* | Enterprise tier รองรับ — deploy บน private cloud / VPC |
| *"AI ทำได้แค่ไหน"* | Roadmap Q3-Q4: OCR ใบกำกับ, anomaly detection, NL query (Gemini/Claude integration) |

---

## 11. Visual / Brand Direction สำหรับ Presentation

### Theme
- **หลัก:** "Climate Action" — earth, green, amber sunrise
- **รอง:** Professional / Corporate (suits boardroom)

### Color Palette
- Primary: **Emerald 600** (#059669) — sustainability
- Accent: **Amber 500** (#f59e0b) — urgency (warming)
- Cool: **Sky 500** (#0ea5e9) — earth / ocean
- Neutral: **Slate 900 / 50** — text / background

### Iconography
- 🌍 Earth (planet view)
- 🌱 Leaf (growth)
- ⚡ Lightning (real-time)
- 🌡️ Thermometer (climate metric)
- 🌳 Tree (carbon offset)

### Photography Direction
- Earth from space (มี mood สง่า)
- Solar panels, wind turbines (clean energy)
- Forest / ocean (เก็บความเป็นธรรมชาติ)
- หลีกเลี่ยง: smokestack, pollution (depressing)

### Slide Templates ที่ควรเตรียม
1. Title slide (logo + Earth background)
2. Problem statement (3 stats + pain points)
3. Solution overview (1 slide with architecture)
4. Feature showcase (gallery 6-8 screenshots)
5. Case study (NSL Foods numbers)
6. Pricing table
7. Roadmap (Q1-Q4)
8. Q&A / Contact

---

## 12. Suggested Assets to Prepare

- [ ] **Screenshots HD (1920x1080)** ของทุกหน้าหลัก (Auth, Dashboard, DataEntry, Reports x4, AuditLog)
- [ ] **Demo video 3 นาที** — workflow login → entry → report (record screen + voiceover)
- [ ] **Customer testimonial** จาก NSL Foods (อ้างถึงผู้ใช้งานจริงในระบบ)
- [ ] **One-pager PDF** สรุปทุกอย่างใน 1 หน้า — แจกใน trade show
- [ ] **Pitch deck (Keynote/PPT)** — 15-20 สไลด์ตาม flow ข้อ 9
- [ ] **ROI Calculator** (Excel) — ลูกค้ากรอกจำนวน user/site → คำนวณ ROI
- [ ] **Comparison Chart** (vs Excel / vs Foreign / vs Custom) — สำหรับ comparison ใน proposal

---

## 13. Key Numbers สำหรับ Quoted Stats

> ใช้ในสไลด์ — ตัวเลขเหล่านี้ verified จากระบบ NSL Foods จริง

- **5 บริษัท / 10 sites** ในเครือ
- **21 users** ใช้งานต่อเนื่อง
- **2,172 metric records** บันทึกในระบบ
- **3,390 audit log entries**
- **34 ESG metrics** ตามมาตรฐาน
- **3 มิติ ESG** ครบ Environmental / Social / Governance
- **5 edge functions** ในระบบ user management
- **2 ภาษา** TH/EN
- **5 roles** ตามลำดับสิทธิ์
- **99.9% Uptime** (Firebase + Supabase SLA)

---

## 14. Sales Process / Next Steps

### Stage 1 — Qualify (รู้จักลูกค้า)
- เป็น SET-listed / EU export / supply chain หรือไม่
- มีทีม CSR / Sustainability หรือยัง
- ปีนี้มีโจทย์ ESG อะไร

### Stage 2 — Demo (วันที่ 1-7)
- Run pitch + live demo ตาม flow ข้อ 9
- ฝาก One-pager + Demo video

### Stage 3 — Pilot Proposal (วันที่ 7-21)
- เสนอ Pilot 30 วัน — D2Infinite migrate 1 site/บริษัทให้ฟรี
- รวบรวม requirement เฉพาะลูกค้า

### Stage 4 — Pilot → Production (วันที่ 21-60)
- Train users
- Customize report templates
- Deploy

### Stage 5 — Renew + Expand (เดือนที่ 12)
- Renewal contract
- Upsell: Add modules (CBAM, AI, Mobile App)

---

## 15. Contact / Internal Resources

- **Product Owner:** D2Infinite Co.,Ltd.
- **Tech Lead:** ทีมพัฒนา D2Infinite
- **Reference Customer:** NSL Foods PCL.
- **Production Demo URL:** https://smartesg-af75b.web.app (request access ก่อนใช้สาธิตจริง)
- **License notice:** ห้ามทำ presentation / demo / share โดยไม่ได้รับอนุญาตจาก D2Infinite เป็นลายลักษณ์อักษร

---

## Appendix — One-liner Tagline Options

> เลือก 1-2 อันสำหรับใช้บน hero slide:

1. *"From Compliance to Climate Action — ESG Made Simple"*
2. *"ระบบเดียวที่ทำให้รายงาน ESG ของคุณเป็นเรื่องง่าย"*
3. *"Track. Report. Act. — เพื่ออนาคตที่ยั่งยืน"*
4. *"Audit-Ready, Investor-Ready, Future-Ready"*
5. *"ESG Reporting แบบ Real-Time — ไม่ต้องรอสิ้นปี"*

---

© 2026 D2Infinite Co.,Ltd. All rights reserved.
ESG Smart Performance — Climate Action Platform v2.6
