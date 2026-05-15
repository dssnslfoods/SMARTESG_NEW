# ESG Hub — AI Handoff Document

> **Purpose:** เอกสารส่งต่อสำหรับ AI agent / นักพัฒนา ที่จะมาดูแล/พัฒนาระบบต่อ
> ให้เข้าใจสถาปัตยกรรม โดเมน และข้อกำหนดสำคัญทั้งหมดได้ภายใน 10 นาที
> **Last updated:** 2026-05-15

---

## 1. ภาพรวมระบบ (What is this?)

**ESG Hub** = ระบบบันทึก/รายงานข้อมูล ESG (Environmental, Social, Governance) ระดับองค์กร
- **ผู้ใช้หลัก:** บริษัท + ไซต์ปฏิบัติงานหลายแห่ง บันทึกตัวชี้วัด ESG รายเดือน
- **ภาษา:** Bilingual ไทย/อังกฤษ (UI labels), schema field เป็น English snake_case
- **Output:** Dashboard, รายงาน ESG (Environmental / Social / Governance / Overview), TV fullscreen mode, Excel export, Audit log
- **Live URL:** https://vital-esg-hub.lovable.app
- **Custom domain:** https://esgnsl.def2design.com

---

## 2. Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 + Tailwind v3 |
| UI Kit | shadcn/ui (Radix), lucide-react icons |
| Animation | framer-motion, custom `iosPageEnter` |
| Backend | Supabase (Postgres + Auth + Edge Functions + RLS) |
| Charts | Recharts |
| Excel | SheetJS (`xlsx`) — client-side, zero-DB |
| State | React Context (Auth, Language, Notifications, ReportSections, TVMode) |

> **No Next.js / no SSR.** Client-side React only.

---

## 3. Design System (CRITICAL — must follow)

**Liquid Glass (iOS 26):**
- `backdrop-blur-xl saturate-200` + `bg-white/70` + `border-white/40` + `rounded-3xl`
- Page transitions: `className="ios-page-enter"` (defined in `index.css`)
- Never use raw color classes like `bg-blue-500` — use **semantic tokens** in `index.css` and `tailwind.config.ts`
- Colors are HSL only

**Component rules:**
- **Never wrap pages in `MainLayout`** — layout is applied at router level
- Radix `Select` placeholder for "All" must use `value="__all__"` (empty string is forbidden)
- Use `KPICard` component with semantic variants for dashboard tiles
- Loading bars: use `<LoadingProgress />` for fetch progress

---

## 4. Roles & RBAC (5 levels)

| Role | Capabilities |
|---|---|
| **admin** | Full CRUD on everything; only one who can manage `app_setting`, `audit_log`, `user_roles` deletion |
| **executive** | Read-only — sees ALL `metric_value` regardless of status; views dashboards/reports |
| **supervisor** | Like admin EXCEPT cannot delete `user_roles`, cannot manage `app_setting`/`audit_log` |
| **staff** | CRUD only own data (`submitted_by = auth.uid()`); sees only own `site_id`; insert allowed if `status ∈ {draft, submitted}` |
| **guest** | Default for new signups; sees only `metric_value` with `status='approved'`; sidebar shows visual-only links |

**Auth flow:**
- New signup → trigger creates `app_user_profile` (full_name) + `user_roles` row with `'guest'` + `is_active=true` (default)
- Inactive users (`is_active=false`) are gated by `is_user_active(uid)` in nearly every RLS policy
- Admin promotes via `user_roles` upsert (one role per user in practice — see `user-role-integrity` memory)

**Role gatekeeper functions (security definer):**
- `has_role(uid, role)` — single source of truth, used in all policies
- `is_user_active(uid)` — checks `app_user_profile.is_active`
- `get_user_site(uid)`, `get_user_company(uid)` — for staff site-scoping

---

## 5. Database Schema (11 tables, all RLS-protected)

```text
auth.users (Supabase managed)
   ↓ trigger: handle_new_user + handle_new_user_role
app_user_profile (user_id PK, company_id, site_id, is_active, full_name)
user_roles (user_id, role enum) — UNIQUE(user_id, role)

company (company_id PK)
   ↓
site (site_id PK, company_id)
   ↓
esg_dimension → esg_theme → esg_metric (text PKs, no FK constraints)
                                ↓
reporting_period (period_id "YYYY-MM", year, month, month_name)
                                ↓
metric_value (value_id PK, metric_id, site_id, period_id,
              value, status, submitted_by, ...)
              UNIQUE (site_id, period_id, metric_id) ← upsert key

audit_log (log_id, actor_user_id, action, entity_type, entity_id, before/after jsonb)
app_setting (key PK, value, updated_by) — admin-only writable
```

**Important conventions:**
- All master data uses **text IDs with prefix conventions** (see `auto-id-generation-v3` memory)
- `metric_value.status` is strictly `'draft'` or `'submitted'` (older code may show `'approved'` in RLS — keep but no UI sets it)
- `metric_value` upserts on `(site_id, period_id, metric_id)` — never insert duplicates
- `period_id` format: `YYYY-MM` (e.g. `2026-04`)

---

## 6. Key Files & Folders

```text
src/
├── App.tsx                       — routing + role-gated routes
├── pages/
│   ├── Auth.tsx                  — fullscreen login (see login-page-v2-6 memory)
│   ├── Dashboard.tsx             — main KPI dashboard
│   ├── DataEntry.tsx             — primary CRUD page (filters, paging from app_setting)
│   ├── UserManagement.tsx        — admin/supervisor user mgmt
│   ├── AuditLog.tsx              — admin-only audit viewer
│   ├── BackupData.tsx            — Excel-based 11-col import/export
│   ├── master/
│   │   ├── CompanyManagement.tsx
│   │   ├── SiteManagement.tsx
│   │   ├── DimensionManagement.tsx
│   │   ├── ThemeManagement.tsx
│   │   ├── MetricManagement.tsx
│   │   ├── PeriodManagement.tsx
│   │   └── SystemSettings.tsx    — admin-only: page size + period filter config
│   └── reports/
│       ├── ESGOverview.tsx
│       ├── Environmental.tsx
│       ├── Social.tsx            — incl. LTIFR formula
│       └── Governance.tsx
├── components/
│   ├── layout/ {Sidebar, Header, MainLayout (do NOT use), NotificationBell}
│   ├── dashboard/AdminAnalyticsDashboard.tsx
│   ├── reports/ {TrendAnalytics, FullscreenButton, TVNavBar, ...}
│   └── ui/ (shadcn — kpi-card, loading-progress, status-badge are custom)
├── hooks/
│   ├── useAuditLog.ts            — wraps create_audit_log RPC
│   ├── useOptimizedData.ts       — 1000-row bypass via offset loop
│   ├── useDeleteValidation.ts    — blocks deletes when dependencies exist
│   └── useRealtimeNotifications.ts
├── contexts/ {Auth, Language, Notifications, ReportSections, TVMode}
├── lib/
│   ├── dataFetcher.ts            — paginated fetch for 100k+ rows
│   ├── excelExport.ts            — bilingual headers
│   └── i18n.ts
└── integrations/supabase/
    ├── client.ts                 ⚠️ AUTO-GENERATED — never edit
    └── types.ts                  ⚠️ AUTO-GENERATED — never edit

supabase/
├── config.toml                   — only edit function-specific blocks
├── migrations/                   — append-only, never edit existing
└── functions/                    — Edge Functions (Deno)
    ├── create-user/              — admin creates user via service role
    ├── delete-user/
    ├── update-user-email/
    ├── update-password/          — admin password reset
    └── get-user-email/
```

---

## 7. Edge Functions

All require `SUPABASE_SERVICE_ROLE_KEY` (already set as secret). Pattern:
1. CORS headers + OPTIONS preflight
2. Create admin client with service role
3. Validate inputs
4. Call `supabaseAdmin.auth.admin.*`
5. Return JSON

**Auto-deployed** — do not tell user to deploy manually.

---

## 8. Performance Patterns (must follow)

- **1000-row Supabase limit:** ALWAYS use offset loop via `lib/dataFetcher.ts` for tables >1k rows (esp. `metric_value`)
- **KPI counts:** use `.select('*', { count: 'exact', head: true })` to avoid pulling rows
- **Dashboard aggregation:** continuous timeline charts span multiple years — see `dashboard-aggregation-logic` memory
- **Loading UX:** show `<LoadingProgress />` whenever fetching >1k rows

---

## 9. Data Entry Page (most complex page)

`src/pages/DataEntry.tsx` features:
- Page size: configurable via `app_setting.data_entry_page_size` (admin sets in System Settings)
- Period filter: configurable mode `recent | from | all` via 5 `app_setting` keys
- Drafts (`status='draft'`) ALWAYS visible regardless of period filter
- Default sort: `updated_at DESC`
- Site dropdown is constrained by selected company (filter validation)
- Filter-drop diagnostic indicator shows why a row is hidden
- Admin can edit submitted records (administrative override)
- Independent month/year selectors (separated lookups, not one combo)
- Active periods card displays the currently filtered window for transparency

---

## 10. Reports & Dashboards

- **TrendAnalytics:** unified engine for all report tabs (E/S/G); labels are localized via i18n
- **TV Fullscreen mode:** triggered by `FullscreenButton`, uses `TVModeContext` + `TVNavBar` for digital signage
- **Excel export:** `excelExport.ts` produces bilingual headers; client-side, no DB roundtrip
- **LTIFR formula:** `(lost_time_injuries × 1,000,000) / total_hours_worked` — implemented in Social report
- **Number formatting:** all numeric displays use `toLocaleString()` for thousands separators

---

## 11. Audit Logging

Every CRUD on master data + `metric_value` should call:
```ts
const { logActivity } = useAuditLog();
await logActivity({
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBMIT',
  entityType: 'metric_value',
  entityId: row.value_id,
  beforeData: oldRow,   // jsonb
  afterData: newRow,    // jsonb
});
```
Backend RPC `create_audit_log` writes with `auth.uid()` as `actor_user_id`.

---

## 12. Notifications

`NotificationsContext` + `useRealtimeNotifications` hook subscribes to Supabase Realtime channels.
Toast triggers on: new submission, status change, master data updates.
**To enable realtime on a new table:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>;`

---

## 13. App Setting Keys (admin-configurable)

| Key | Purpose | Values |
|---|---|---|
| `data_entry_page_size` | Rows per page on Data Entry | `10/15/25/50/100/200` |
| `data_entry_filter_mode` | Period filter strategy | `recent` / `from` / `all` |
| `data_entry_recent_months` | N months back from latest data | `1..24` |
| `data_entry_from_year` | Cutoff year | e.g. `2025` |
| `data_entry_from_month` | Cutoff month | `1..12` |

Loaded on `DataEntry` mount via `.in('key', [...])` against `app_setting`.

---

## 14. Bootstrap a Fresh Backend (External Supabase)

1. Create new Supabase project
2. Run `/mnt/documents/schema_external_supabase.sql` in SQL Editor
3. Configure Auth providers (Email + Google) in dashboard
4. Sign up the first user via app
5. Run bootstrap section #9 in the SQL file:
   ```sql
   UPDATE public.app_user_profile SET is_active=true WHERE user_id='<UID>';
   INSERT INTO public.user_roles (user_id, role) VALUES ('<UID>','admin')
     ON CONFLICT (user_id, role) DO NOTHING;
   ```
6. Update frontend `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
7. Seed master data: company → site → dimension → theme → metric → period

---

## 15. DO NOT (hard rules)

- ❌ Edit `src/integrations/supabase/{client,types}.ts` — auto-generated
- ❌ Edit `.env` manually — Supabase integration manages it
- ❌ Edit existing migrations — always create a new one
- ❌ Wrap pages in `MainLayout` (already at router level)
- ❌ Store roles in `app_user_profile` — must use `user_roles` (privilege escalation risk)
- ❌ Use raw color classes (`bg-blue-500`) — use semantic tokens
- ❌ CHECK constraints with time logic (`expire_at > now()`) — use validation triggers
- ❌ Anonymous sign-ups — always email/password + Google
- ❌ Auto-confirm email unless explicitly requested
- ❌ Touch reserved schemas (`auth`, `storage`, `realtime`, `vault`)
- ❌ Use empty string `""` for Radix Select items — use `__all__`

---

## 16. Common Gotchas

- **"infinite recursion in policy":** never query the same table inside its own RLS — use a security definer function
- **Missing data in dashboard:** check 1000-row limit first; use offset loop pattern
- **RLS blocks legitimate user:** check `is_user_active(uid)` returns true; check role assignment
- **Date format mismatch:** `period_id` is `YYYY-MM` text, not a date — sort lexicographically
- **Empty state in DataEntry:** check `app_setting.data_entry_filter_mode` — may be filtering out rows; drafts are always shown

---

## 17. Memory System

The project uses a `mem://` memory index with 40+ entries documenting specific decisions.
**Always check `mem://index.md` first** before making decisions about:
- UI patterns (loading-progress-ux, kpi-card-variants, role-visual-hierarchy-v2)
- Workflows (workflow-and-safeguards-v9, administrative-edit-rights)
- Auth (rbac-roles-v3, supervisor-permissions-v8, password-management-v11)
- Reporting (trend-analytics-engine-v6, comprehensive-esg-reporting-suite)

Memory rules are **enforced** — violating one is a regression.

---

## 18. Useful Tools When Continuing

- `supabase--migration` — schema changes only (DDL)
- `supabase--insert` — DML (INSERT/UPDATE/DELETE)
- `supabase--read_query` — debugging SELECT
- `supabase--linter` — RLS sanity check
- `security--run_security_scan` — full security audit

---

## 19. File Index

| File | Purpose |
|---|---|
| `/mnt/documents/schema_external_supabase.sql` | Self-contained SQL to recreate the entire backend |
| `/mnt/documents/HANDOFF.md` | This document |

---

**End of handoff.** Start by reading: `mem://index.md` → `src/App.tsx` → `src/pages/DataEntry.tsx` → this doc.
