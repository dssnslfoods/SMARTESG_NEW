# SMARTESG — AI Agent Handoff Document

> **Product**: ESG Smart Performance
> **Company**: D2Infinite Co., Ltd.
> **Production URL**: https://smartesg-af75b.web.app
> **Repository**: github.com/dssnslfoods/SMARTESG_NEW (branch: `main`)
> **Local Path**: `/Users/golf/Desktop/Projects/SMARTESG/SMARTESG_NEW`
> **Last Updated**: 2026-06-18

---

## 1. What Is This System?

SMARTESG is a **multi-tenant SaaS web application** for collecting, managing, and reporting ESG (Environmental, Social, Governance) data. It follows the **GHG Protocol** for greenhouse gas emissions and supports bilingual UI (Thai/English).

**Core workflow**: Admin sets up master data (companies, sites, dimensions, themes, metrics, targets) → Staff enters data per site/period → System aggregates and displays dashboards/reports → Executive reviews ESG performance.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + Radix UI + lucide-react |
| Charts | Recharts |
| State | TanStack React Query v5 |
| Routing | React Router v6 |
| Backend | Supabase (PostgreSQL + PostgREST + Auth) |
| Hosting | Firebase Hosting |
| Project ID (Firebase) | `smartesg-af75b` |
| Project ID (Supabase) | `zwzdhbttmtbkjyegsmzz` |

> **No SSR / No Next.js.** Client-side React SPA only.

---

## 3. Multi-Tenant Architecture

### Tenants

| Tenant | ID | Notes |
|--------|----|-------|
| **NSL Foods PCL** | `7ab7fb63-0592-46d1-ae6d-e89449240599` | **PRODUCTION DATA — DO NOT MODIFY** |
| DEMO PLC | `82bd1890-90d9-436d-8e60-d0e827d8be75` | Safe for testing/development |

### CRITICAL RULE

**Never modify, delete, or affect NSL Foods PCL data.** All changes must be tenant-scoped. Always verify tenant isolation before and after any database operation.

### How Tenant Isolation Works

1. **`current_tenant_id()`** — PL/pgSQL STABLE SECURITY DEFINER function that reads the user's `tenant_id` from `app_user_profile`. Uses GUC cache (`app._tid_cache` via `set_config`) for performance.
2. **Row-Level Security (RLS)** — Every table with tenant data has RLS policies that filter by `current_tenant_id()`. Policies use `(select auth.uid())` wrapped in InitPlan for performance.
3. **Helper functions** (all SECURITY DEFINER):
   - `is_super_admin(uuid)` — checks `super_admin` table
   - `has_role(uuid, app_role)` — checks `user_roles` table
   - `is_user_active(uuid)` — checks `app_user_profile.is_active`

---

## 4. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `tenant` | Tenant registry (name, slug, plan) |
| `app_user_profile` | User profile (tenant_id, company_id, site_id, is_active, must_change_password) |
| `user_roles` | One role per user (admin/supervisor/executive/staff/guest/super_admin) |
| `super_admin` | Super admin registry (cross-tenant access) |
| `company` | Companies within a tenant |
| `site` | Sites within a company (has company_id FK) |
| `esg_dimension` | ESG dimensions (Environmental, Social, Governance) |
| `esg_theme` | Themes within dimensions |
| `esg_metric` | Metrics within themes — has `aggregation` (sum/avg) and `calc_mode` (manual/auto) |
| `metric_value` | Actual data entries (value per metric/site/period). Unique on (site_id, period_id, metric_id) |
| `metric_target` | Target values per metric/year |
| `reporting_period` | Reporting periods (year/month/quarter) |

### Permission Tables

| Table | Purpose |
|-------|---------|
| `menu_permission` | Per-role menu visibility (tenant-scoped) |
| `tenant_menu_allowlist` | Tenant-level menu feature gating |
| `tenant_feature` | Feature flags per tenant (e.g., `ghg_auto_calc`) |
| `data_entry_permission` | Per-role CRUD capabilities: can_create, create_scope (all/own_company/own_site), edit_scope (all/own/none), delete_scope (all/own/none) |

### GHG Tables

| Table | Purpose |
|-------|---------|
| `emission_factor` | Active emission factors used in GHG calculations. Has activity_name_th/en, reference_detail, effective_year, active |
| `emission_factor_reference` | Reference library imported from Excel (suggestion source only, not used in calculations) |
| `ghg_calc_mapping` | Maps activity metrics to GHG target metrics for auto-calculation |

### Analytics & System Tables

| Table | Purpose |
|-------|---------|
| `login_event` | Records each successful login (user_id, timestamp, user_agent) |
| `audit_log` | System-wide audit trail |
| `app_setting` | Tenant-scoped application settings (key-value) |

### Key Database Functions (RPCs)

| Function | Purpose |
|----------|---------|
| `current_tenant_id()` | Returns authenticated user's tenant_id (GUC-cached, SECURITY DEFINER) |
| `get_dashboard_metric_stats()` | Server-side aggregated counters for dashboard cards (SECURITY INVOKER, respects RLS) |
| `get_executive_summary(p_year int, p_company_id text, p_site_id text)` | Scope-filtered executive dashboard data. **All params are `text` type, not uuid** |
| `get_ghg_summary()` | GHG dashboard data with Scope 1/2/3 breakdown. Returns `has_scope3` flag |
| `backfill_ghg_emissions()` | Computes GHG from historical activity data (ON CONFLICT DO NOTHING, safe to re-run) |
| `recompute_ghg_target()` | Recalculates aggregated GHG targets from component metrics |
| `seed_new_tenant()` | Initializes a new tenant with default master data |
| `get_or_create_period()` | Gets or creates a reporting period record |
| `get_platform_overview()` | Super-admin platform-wide statistics |
| `get_tenant_activity_list()` | Tenant activity feed for super-admin dashboard |

---

## 5. User Roles & Permissions

### Roles
1. **super_admin** — Cross-tenant access, platform management (bypasses all route guards)
2. **admin** — Full tenant access, all menus, all settings
3. **supervisor** — Master data management, data entry, limited reports
4. **executive** — Reports/dashboards, KPI targets, read-only
5. **staff** — Data entry only (scoped by company/site assignment)
6. **guest** — View-only dashboard and ESG Key Issues

### Permission Layers (4 layers, all must pass)
1. **Route Guard** (`ProtectedRoute` in App.tsx) — React Router level, checks `canAccess(allowedRoles)`
2. **Menu Visibility** (`canSeeMenu()` in MenuPermissionsContext) — Controls sidebar rendering, checks `menu_permission` + `tenant_menu_allowlist`
3. **Feature Flags** (`hasFeature()` in MenuPermissionsContext) — Tenant-level feature gating via `tenant_feature` table
4. **Data Entry Permissions** — Per-role CRUD matrix from `data_entry_permission` table, enforced in DataEntry.tsx

### Feature-Gated Menus (FEATURE_GATED map in Sidebar)
```
reports/ghg         → requires feature 'ghg_auto_calc'
master/ghg-settings → requires feature 'ghg_auto_calc'
```

---

## 6. Frontend Architecture

### Directory Structure
```
src/
├── App.tsx                    # Routes + context providers (lazy-loaded pages)
├── main.tsx                   # Entry point, wraps App in ErrorBoundary
├── contexts/
│   ├── AuthContext.tsx         # Auth state, signIn/signOut, profile sessionStorage cache (30min TTL)
│   ├── MenuPermissionsContext.tsx  # canSeeMenu(), hasFeature()
│   ├── LanguageContext.tsx     # Thai/English toggle
│   ├── BrandingContext.tsx     # Tenant branding (logo, colors)
│   ├── ReportSectionsContext.tsx   # Report section config
│   ├── NotificationsContext.tsx    # In-app notifications
│   └── TVModeContext.tsx       # TV display / digital signage mode
├── hooks/
│   ├── useOptimizedData.ts    # Dashboard data with RPC-based stats
│   ├── useAuditLog.ts         # Audit logging helper
│   ├── useDeleteValidation.ts # Pre-delete dependency check
│   └── usePlanLimits.ts       # Plan-based feature limits
├── lib/
│   ├── menuConfig.ts          # Single source of truth for all menu items + default permissions
│   ├── dataFetcher.ts         # Supabase paginated query helpers
│   ├── i18n.ts                # Translation utilities
│   └── excelExport.ts         # Excel export helper
├── pages/
│   ├── Auth.tsx               # Login page (no tenant name shown pre-auth)
│   ├── Dashboard.tsx          # Admin analytics dashboard OR executive dashboard (by role)
│   ├── DataEntry.tsx          # Filter-first, search-on-demand data entry
│   ├── ESGKeyIssues.tsx       # ESG materiality matrix with Company/Site/Year scope filters
│   ├── HelpCenter.tsx         # Permission-aware bilingual user manual
│   ├── master/
│   │   ├── GhgSettings.tsx    # GHG config: EF reference library, scope 1/2/3 groups, auto/manual toggle, suggest/backfill
│   │   ├── DataEntryPermission.tsx  # Per-role CRUD capability matrix editor
│   │   ├── TargetManagement.tsx     # KPI target setting per metric/year
│   │   ├── MenuPermission.tsx       # Menu visibility per role
│   │   └── ... (Company, Site, Dimension, Theme, Metric, Period, SystemSettings)
│   ├── reports/
│   │   ├── GhgDashboard.tsx   # GHG dashboard with Scope 1/2/3, tooltips, target reference lines
│   │   ├── ESGOverview.tsx    # Aggregated ESG overview
│   │   └── Environmental.tsx, Social.tsx, Governance.tsx
│   └── super/                 # Super-admin only pages
│       ├── TenantManagement.tsx
│       ├── TenantMenuAccess.tsx
│       └── PlanManagement.tsx
├── components/
│   ├── ErrorBoundary.tsx      # Global error boundary — auto-reloads on stale chunk-load errors
│   ├── ProtectedRoute.tsx     # Route guard (role check)
│   ├── layout/                # Sidebar, Header
│   ├── dashboard/
│   │   ├── ExecutiveDashboard.tsx      # Executive view with Company/Site/Year scope filters
│   │   └── AdminAnalyticsDashboard.tsx # Admin analytics with login tracking cards
│   └── ui/                    # shadcn/ui components
└── integrations/supabase/
    ├── client.ts              # Supabase client instance
    └── types.ts               # Auto-generated TypeScript types
```

### Key Frontend Patterns

1. **Lazy Loading** — All pages except Auth/ResetPassword/NotFound use `React.lazy()` for code splitting
2. **Error Boundary** — Global `ErrorBoundary` in main.tsx detects chunk-load failures (stale JS after deploy) and auto-reloads once (guarded by sessionStorage timestamp to prevent loops)
3. **Session Cache** — AuthContext caches profile/role in sessionStorage (30-min TTL) to skip 3-query round-trip on page refresh. Invalidated on sign-out and on explicit sign-in (skipCache: true)
4. **React Query** — staleTime: 5min, gcTime: 10min, refetchOnWindowFocus: false, retry: 1
5. **PostgREST Pagination** — All list queries use pagination loops (PAGE_SIZE=1000) to overcome PostgREST's default 1000-row limit. Every loop fetches until `data.length < PAGE_SIZE`
6. **Filter-First Pattern** — DataEntry loads master data on mount (lightweight), fetches records only on search button click (hasSearched state flag)
7. **Server-Side Stats** — Dashboard top cards use `get_dashboard_metric_stats()` RPC instead of streaming all rows to count client-side (was the root cause of staff dashboard being slower than admin)

---

## 7. GHG Protocol Implementation

### Scopes
- **Scope 1**: Direct emissions (fuel combustion, company vehicles, refrigerants)
- **Scope 2**: Indirect emissions from purchased electricity
- **Scope 3**: Other indirect emissions (upstream transport, business travel, waste)

### Calculation Formula
```
Activity Data × Emission Factor ÷ 1000 = tCO₂e
```

### Auto-Calc Flow
1. Admin configures activities in GHG Settings, grouped by Scope
2. Each activity has Auto/Manual toggle
3. Auto mode: `ghg_calc_mapping` links activity metric → GHG target metric
4. `esg_metric.calc_mode` = 'auto' marks the metric for automatic GHG calculation
5. `backfill_ghg_emissions()` retroactively computes GHG from historical activity data (safe, ON CONFLICT DO NOTHING)

### Emission Factor Reference Library
- Imported from Excel → `emission_factor_reference` table
- Used for **suggestions only** (fuzzy Levenshtein matching)
- Threshold: ratio >= 0.6 for auto-apply; any% for manual "Suggest" button click
- Low-confidence matches shown with warning icon and tooltip
- Active factors in `emission_factor` table are what the GHG calc actually uses
- Users must explicitly **Save** suggested values — suggestions alone are NOT applied

### GHG Dashboard (GhgDashboard.tsx)
- KPI cards for Scope 1/2/3 totals
- Donut chart (scope breakdown), monthly trend (YTD current year only), by-site bars
- Net-Zero Trajectory: stacked bars by scope + horizontal ReferenceLine for target
- Monthly average target line (annual target ÷ 12)
- Color scheme: Scope 1 = red (#ef4444), Scope 2 = amber (#f59e0b), Scope 3 = blue (#3b82f6)
- `has_scope3` flag from `get_ghg_summary()` RPC drives adaptive layout (hides Scope 3 UI when no data)
- InfoTip (hover i icon) on every card with bilingual explanation

---

## 8. Deployment Workflow

### Build & Deploy
```bash
cd /Users/golf/Desktop/Projects/SMARTESG/SMARTESG_NEW
npm run build                    # Vite production build → dist/
firebase deploy --only hosting   # Deploy to Firebase Hosting
```

### Git
```bash
git add -A
git commit -m "description"
git push origin main
```

- Work directly on `main` branch (no branching strategy)
- Deploy Firebase + commit/push after each change
- No CI/CD pipeline — manual deploy only

### Important Deploy Notes
- After deploy, users may have stale JS chunks cached. The `ErrorBoundary` auto-reloads on chunk-load errors (one-time, guarded by sessionStorage timestamp).
- `index.html`: `Cache-Control: no-cache, no-store, must-revalidate`
- Static assets (js/css/fonts/images): `Cache-Control: public, max-age=31536000, immutable`
- **Never use `manualChunks` in vite.config.ts** — caused circular dependency crash with recharts/d3 (entire app went blank in production)

---

## 9. Bilingual Support (Thai/English)

- `LanguageContext` provides `language` state and `setLanguage()` toggle
- Most pages have inline Thai/English labels (conditional rendering, not a full i18n framework)
- `src/lib/i18n.ts` provides translation utilities
- Menu items: `label` (EN) + `labelTh` (TH) in `menuConfig.ts`
- Help Center: fully bilingual content per guide entry
- Database fields: some tables have both `_th` and `_en` name columns (e.g., emission_factor)

---

## 10. Edge Functions (Supabase / Deno)

Located in `supabase/functions/`. All use service role key, pattern:
1. CORS headers + OPTIONS preflight handling
2. Create admin Supabase client with service role
3. Validate inputs
4. Call `supabaseAdmin.auth.admin.*` methods
5. Return JSON response

| Function | Purpose |
|----------|---------|
| `create-user` | Admin creates a new user |
| `delete-user` | Admin deletes a user |
| `update-user-email` | Admin updates user email |
| `update-password` | Admin resets user password |
| `get-user-email` | Retrieve user email by ID |

---

## 11. Known Constraints & Gotchas

1. **PostgREST 1000-row limit** — Always paginate with loops (fetch until `data.length < PAGE_SIZE`)
2. **RLS InitPlan optimization** — All `auth.uid()`/`auth.role()`/`auth.jwt()` in RLS policies MUST be wrapped in `(select ...)` for performance
3. **RPC parameter types** — `get_executive_summary` uses `text` params, not `uuid`, because all IDs in schema are `text`
4. **Metric aggregation** — `esg_metric.aggregation` = 'sum' (default) or 'avg' — controls how multi-site values roll up
5. **Login tracking** — Fire-and-forget insert to `login_event` on sign-in; never blocks auth flow
6. **Fuzzy matching** — Levenshtein ratio >= 0.6 for auto-apply; any% for manual Suggest. Below threshold shows warning icon
7. **No test suite** — No automated tests; all testing is manual in browser
8. **Radix Select** — For "All" placeholder, use `value="__all__"` (empty string forbidden in Radix)
9. **Infinite recursion in RLS** — Never query the same table inside its own RLS policy; use a SECURITY DEFINER function instead
10. **metric_value upsert** — Uses unique constraint on `(site_id, period_id, metric_id)` — never insert duplicates

---

## 12. Audit Logging

CRUD operations on master data and `metric_value` should call:
```ts
const { logActivity } = useAuditLog();
await logActivity({
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBMIT',
  entityType: 'metric_value',
  entityId: row.value_id,
  beforeData: oldRow,
  afterData: newRow,
});
```

---

## 13. Common Tasks for AI Agent

### Adding a new menu item
1. Add entry to `MENU_ITEMS` in `src/lib/menuConfig.ts` (key, label, labelTh, section)
2. Add lazy import + `<Route>` in `src/App.tsx` (with ProtectedRoute wrapper)
3. Add sidebar entry in `src/components/layout/Sidebar.tsx`
4. Set default permissions in `DEFAULT_PERMISSIONS` in `menuConfig.ts`

### Adding a new database table
1. Create table in Supabase SQL editor with `tenant_id` column
2. Add RLS policies using `current_tenant_id()` pattern
3. Wrap all `auth.uid()` calls in `(select ...)` — InitPlan optimization
4. Add FK covering indexes if the table has foreign keys
5. **Verify NSL Foods data is unchanged after migration**

### Adding a new metric
1. Insert into `esg_metric` with correct dimension_id, theme_id, aggregation, calc_mode
2. If GHG-related, create `ghg_calc_mapping` linking activity → GHG target metric
3. Add target in `metric_target` if needed

### Checking tenant isolation (run after any DB change)
```sql
SELECT p.tenant_id, t.tenant_name, COUNT(*)
FROM metric_value mv
JOIN app_user_profile p ON p.user_id = mv.created_by
JOIN tenant t ON t.id = p.tenant_id
GROUP BY p.tenant_id, t.tenant_name;
-- NSL Foods should have 2291 metric_values (as of 2026-06-18)
```

---

## 14. Supabase RLS Policy Pattern

```sql
-- Standard SELECT policy
CREATE POLICY "tenant_isolation_select" ON public.table_name
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    OR (select is_super_admin((select auth.uid())))
  );

-- Standard INSERT policy
CREATE POLICY "tenant_isolation_insert" ON public.table_name
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
  );
```

Always use `(select auth.uid())` (not bare `auth.uid()`) in RLS policies.

---

## 15. App Setting Keys (admin-configurable via System Settings)

| Key | Purpose | Values |
|-----|---------|--------|
| `data_entry_page_size` | Rows per page on Data Entry | 10/15/25/50/100/200 |
| `data_entry_filter_mode` | Period filter strategy | recent / from / all |
| `data_entry_recent_months` | N months back from latest data | 1..24 |
| `data_entry_from_year` | Cutoff year | e.g. 2025 |
| `data_entry_from_month` | Cutoff month | 1..12 |

---

## 16. DO NOT (Hard Rules)

- Do not modify NSL Foods PCL data under any circumstances
- Do not use `manualChunks` in vite.config.ts (causes recharts crash)
- Do not edit existing Supabase migrations — always create new ones
- Do not store roles in `app_user_profile` — use `user_roles` table only
- Do not use bare `auth.uid()` in RLS policies — always wrap in `(select ...)`
- Do not skip the PostgREST pagination loop for any table that could exceed 1000 rows
- Do not add `--no-verify` or skip git hooks

---

## 17. Environment & Credentials

- **Supabase URL**: `https://zwzdhbttmtbkjyegsmzz.supabase.co`
- **Supabase anon key**: Located in `src/integrations/supabase/client.ts`
- **Firebase project**: `smartesg-af75b` (configured in `.firebaserc`)
- **Node.js**: Requires Node 18+
- **Package manager**: npm

---

## 18. Contact

- **Owner**: Golf (arpaket@gmail.com)
- **Company**: D2Infinite Co., Ltd.

---

**Getting started**: Read `src/App.tsx` (routes + providers) → `src/lib/menuConfig.ts` (all menus) → `src/contexts/AuthContext.tsx` (auth flow) → `src/pages/DataEntry.tsx` (most complex page) → this document.
