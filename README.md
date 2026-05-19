# ESG Smart Performance

> ระบบจัดการและรายงานความยั่งยืน (Environmental, Social, Governance) สำหรับองค์กร
> เพื่อขับเคลื่อนการลดผลกระทบต่อสิ่งแวดล้อมและต่อสู้ภาวะโลกร้อน

**Production:** [https://smartesg-af75b.web.app](https://smartesg-af75b.web.app)
**Version:** v2.6 — Climate Action Platform

---

## License & Ownership

> **ESG Smart Performance Application licensed by D2Infinite Co.,Ltd.**
> **ไม่อนุญาตให้ดัดแปลง หรือ modify source code โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร**

All rights reserved. การคัดลอก แจกจ่าย หรือใช้งานในลักษณะใด ๆ ที่นอกเหนือจากที่ได้รับสิทธิ์ใช้งานตามสัญญา ถือเป็นการละเมิดลิขสิทธิ์

---

## ภาพรวมระบบ

ESG Smart Performance คือ multi-tenant web application สำหรับให้องค์กรลูกค้า บันทึก/ติดตาม/รายงาน metric ด้าน ESG ครอบคลุม 3 มิติ:

| มิติ | ตัวอย่าง Metric |
|---|---|
| **Environmental (E)** | ปริมาณน้ำใช้, พลังงานไฟฟ้า, ขยะ, การปล่อย GHG, น้ำเสีย |
| **Social (S)** | จำนวนพนักงาน, ชม.ฝึกอบรม, อุบัติเหตุ, ความหลากหลาย |
| **Governance (G)** | เหตุการณ์ทุจริต, การปฏิบัติตามกฎหมาย, ยอดขาย |

### Workflow หลัก

1. **Admin** กำหนด master data (Company, Site, Period, Dimension/Theme/Metric)
2. **Staff** บันทึกค่า metric ตามรอบ (รายเดือน) ของ site ที่ตนรับผิดชอบ
3. **Supervisor/Executive** ตรวจสอบ + อนุมัติข้อมูล
4. ระบบสรุปรายงาน ESG รายเดือน/ปี ส่งออกได้เป็น Excel / PDF
5. ทุกการแก้ไขถูกบันทึกใน **Audit Log** (immutable history)

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | Tailwind CSS + shadcn/ui (Radix primitives) |
| **State / Data** | TanStack Query v5, React Context |
| **Auth & DB** | Supabase (PostgreSQL 15 + PostgREST + Auth + Edge Functions) |
| **Email** | Resend (Tokyo region) — custom SMTP via `def2design.com` |
| **Hosting** | Firebase Hosting |
| **Region** | Supabase: Tokyo (ap-northeast-1) |

---

## โครงสร้างโปรเจกต์

```
.
├── src/
│   ├── pages/                      # หน้าเพจหลัก (route-level components)
│   │   ├── Auth.tsx                # Login / Signup + Forgot password dialog
│   │   ├── ResetPassword.tsx       # ตั้งรหัสผ่านใหม่ (มาจากลิงก์อีเมล)
│   │   ├── Dashboard.tsx           # KPI Dashboard ภาพรวม
│   │   ├── DataEntry.tsx           # บันทึก/แก้ไขค่า metric
│   │   ├── UserManagement.tsx      # จัดการ user + role
│   │   ├── AuditLog.tsx            # ประวัติการเปลี่ยนแปลง
│   │   ├── Reports.tsx             # รายงาน ESG (รวม + ส่งออก)
│   │   ├── BackupData.tsx          # สำรอง / กู้ข้อมูล
│   │   ├── HelpCenter.tsx          # คู่มือการใช้งาน
│   │   ├── master/                 # หน้าจัดการ master data
│   │   │   ├── CompanyManagement.tsx
│   │   │   ├── SiteManagement.tsx
│   │   │   ├── PeriodManagement.tsx
│   │   │   ├── DimensionManagement.tsx
│   │   │   ├── ThemeManagement.tsx
│   │   │   ├── MetricManagement.tsx
│   │   │   └── SystemSettings.tsx
│   │   └── reports/                # รายงานตามมิติ
│   │       ├── ESGOverview.tsx
│   │       ├── Environmental.tsx
│   │       ├── Social.tsx
│   │       └── Governance.tsx
│   ├── contexts/                   # React Context providers
│   │   ├── AuthContext.tsx         # user, role, profile, session
│   │   ├── LanguageContext.tsx     # TH / EN switcher
│   │   ├── NotificationsContext.tsx
│   │   ├── ReportSectionsContext.tsx
│   │   └── TVModeContext.tsx
│   ├── hooks/                      # Custom hooks
│   │   ├── useAuditLog.ts          # บันทึก audit อัตโนมัติ
│   │   ├── useOptimizedData.ts     # cache + pagination
│   │   ├── useRealtimeNotifications.ts
│   │   ├── useDeleteValidation.ts
│   │   └── usePullToRefresh.ts
│   ├── integrations/supabase/      # Supabase client + generated types
│   ├── lib/                        # Utility / helpers
│   └── components/ui/              # shadcn/ui components
├── supabase/
│   ├── config.toml                 # Project ID, SMTP, email templates
│   ├── functions/                  # Edge Functions (Deno)
│   │   ├── create-user/
│   │   ├── delete-user/
│   │   ├── get-user-email/
│   │   ├── update-user-email/
│   │   └── update-password/
│   ├── templates/recovery.html     # อีเมล reset password (HTML)
│   └── migrations/                 # Schema migrations
├── firebase.json                   # Firebase Hosting config (SPA rewrites + cache headers)
├── .firebaserc                     # Firebase project alias (smartesg-af75b)
└── .env                            # VITE_SUPABASE_URL / KEY (gitignored)
```

---

## บทบาทผู้ใช้ (Role)

| Role | สิทธิ์ |
|---|---|
| **admin** | จัดการ user + master data + อนุมัติ + ดูทั้งหมด + ลบข้อมูล |
| **executive** | ดู dashboard + รายงานทั้งบริษัทในเครือ |
| **supervisor** | จัดการ metric ของบริษัทที่รับผิดชอบ + อนุมัติ |
| **staff** | บันทึกข้อมูล metric ของ site ที่กำหนด |
| **guest** | placeholder ก่อนได้รับ role |

Role ถูกเก็บใน `public.user_roles` แยกจาก `auth.users` (ตาม Supabase best practice เพื่อ RLS)

---

## Database Schema (Public schema)

| Table | บทบาท |
|---|---|
| `company` | บริษัทในเครือ (5 entities) |
| `site` | สถานประกอบการ (10 sites) |
| `esg_dimension` | E / S / G |
| `esg_theme` | หัวข้อย่อยใต้แต่ละมิติ |
| `esg_metric` | ตัวชี้วัด (~34 metrics) |
| `reporting_period` | รอบรายงาน (รายเดือน) |
| `metric_value` | ค่าที่บันทึก — มี `UNIQUE (site_id, period_id, metric_id)` |
| `app_user_profile` | profile ของ user (full_name, company, site) |
| `user_roles` | role ของ user (ลิงก์ auth.users) |
| `audit_log` | ประวัติการเปลี่ยนแปลง (CREATE / UPDATE / DELETE) |
| `app_setting` | การตั้งค่าระบบ (page size, period filter, ฯลฯ) |

Foreign keys ครบทุก relationship เพื่อให้ PostgREST embed query ทำงานได้

---

## Auth Flow

1. **Login:** Supabase Auth (email + password) → JWT ใน localStorage → fetch profile + role
2. **Sign up:** สร้าง user → trigger `handle_new_user` insert profile + role='guest' → admin ตั้ง role
3. **Reset password:**
   - User กด "ลืมรหัสผ่าน?" → ใส่ email
   - เรียก `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
   - ระบบส่งอีเมลผ่าน Resend (template ภาษาไทย พร้อม brand)
   - User กดลิงก์ → `/reset-password` → `supabase.auth.updateUser({ password })` → signOut → login ใหม่
4. **Admin reset (manual):** Supabase Dashboard → Users → "Send password recovery"

---

## การพัฒนา / Maintenance

> ⚠️ การ build / run / deploy เพื่อบำรุงรักษาเท่านั้น — ห้ามแก้ไขโค้ดโดยไม่ได้รับอนุญาตจาก D2Infinite

### ติดตั้ง

```bash
npm install
```

### Environment Variables

สร้างไฟล์ `.env` ที่ root (อย่า commit):

```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
```

### Run dev server

```bash
npm run dev
```

### Build

```bash
npm run build
```

ผลลัพธ์อยู่ที่ `dist/`

### Deploy (Firebase Hosting)

```bash
firebase deploy --only hosting --project smartesg-af75b
```

### Edge Functions (Supabase)

```bash
supabase functions deploy create-user delete-user get-user-email update-password update-user-email --project-ref <ref>
```

### Push config (SMTP / templates / Site URL)

```bash
SMTP_PASS='<resend-api-key>' supabase config push --yes
```

---

## SMTP / Email Configuration

| Field | Value |
|---|---|
| Provider | **Resend** (Tokyo region) |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) |
| Sender | `no-reply@def2design.com` (verified domain) |
| Sender Name | `ESG Smart Performance` |
| Template | `supabase/templates/recovery.html` (HTML email ภาษาไทย) |

DNS records ที่ต้องตั้งใน `def2design.com`:
- `TXT resend._domainkey` (DKIM)
- `MX send` → `feedback-smtp.ap-northeast-1.amazonses.com` priority 10
- `TXT send` → `v=spf1 include:amazonses.com ~all`

---

## ความปลอดภัย

- **Row Level Security (RLS)** เปิดที่ทุก table ใน `public` schema
- **Service role key** ใช้เฉพาะฝั่ง server (Edge Functions) — ไม่เคย bundle เข้า client
- **Audit log** บันทึก action ทั้งหมด: CREATE / UPDATE / DELETE พร้อม before/after data
- **Password reset link** หมดอายุใน 1 ชั่วโมง ใช้ได้ครั้งเดียว
- **`session_replication_role = 'replica'`** ใช้เฉพาะตอน restore data backup เท่านั้น

---

## Support

ติดต่อ: **D2Infinite Co.,Ltd.**
หากพบ bug หรือต้องการขอ feature ใหม่ กรุณาแจ้ง project owner

---

© 2026 D2Infinite Co.,Ltd. All rights reserved.
ESG Smart Performance Application
