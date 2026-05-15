# AGENT.md — Instructions for AI Coding Agents

This file provides context and guidelines for AI coding agents (Claude, Cursor, Copilot, ฯลฯ) working on the **ESG Smart Performance** codebase.

---

## ⚠️ License Notice

> **ESG Smart Performance Application licensed by D2Infinite Co.,Ltd.**
> **ไม่อนุญาตให้ดัดแปลง หรือ modify source code โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร**

Any AI agent operating on this codebase **must** verify that the requested changes are authorized by D2Infinite Co.,Ltd. Unauthorized modifications constitute a license violation.

---

## Project Snapshot

- **Type:** Single-Page Application (SPA)
- **Stack:** React 18 + TypeScript + Vite + Supabase + Firebase Hosting
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives)
- **State / Data:** TanStack Query v5 + React Context
- **Languages:** TH (default) + EN — driven by `LanguageContext`
- **Deployment:**
  - Frontend → Firebase Hosting project `smartesg-af75b`
  - Backend → Supabase project `zwzdhbttmtbkjyegsmzz` (Tokyo / ap-northeast-1)
- **Production URL:** https://smartesg-af75b.web.app

---

## Code Conventions

### File / Folder

- **Pages** → `src/pages/*.tsx` (one route per file, PascalCase)
- **Sub-pages** → `src/pages/<group>/<Page>.tsx` (e.g. `master/CompanyManagement.tsx`)
- **Contexts** → `src/contexts/<Name>Context.tsx`
- **Hooks** → `src/hooks/use<Name>.ts(x)` (camelCase prefix `use`)
- **Utilities** → `src/lib/`
- **shadcn/ui** components → `src/components/ui/` — DO NOT rename
- **Supabase types** → `src/integrations/supabase/types.ts` (auto-generated, regenerate after schema change)

### TypeScript

- Strict mode is **off** (legacy reasons) — but new code should still be properly typed
- Prefer `type` over `interface` for component props
- Use Supabase's generated `Database` type for table rows:
  ```ts
  import type { Database } from "@/integrations/supabase/types";
  type MetricValue = Database["public"]["Tables"]["metric_value"]["Row"];
  ```

### Styling

- Tailwind utility-first; avoid inline `style={{}}` unless dynamic
- Use **emerald / teal** as primary brand color (ESG green)
- Glassmorphism on auth pages: `backdrop-blur` + semi-transparent white/black
- The "ESG Global Warming" theme uses **amber/sky/teal/emerald** gradients

### Internationalization

- All user-facing text must support both TH/EN:
  ```tsx
  {language === "th" ? "บันทึก" : "Save"}
  ```
- Use `t(key)` from `useLanguage()` for shared phrases
- DO NOT hardcode TH-only text

---

## Supabase Conventions

### Querying

- Always import client from `@/integrations/supabase/client`
- Use `.maybeSingle()` (not `.single()`) when row may not exist
- Use embedded resource syntax when joining: `select=*,company:company_id(company_name)` — relies on **foreign keys** being defined
- Pagination: `.range(from, to)` — server may cap at 1000 rows; advance by `data.length`, not page size

### Mutations & Unique Constraints

- `metric_value` has `UNIQUE (site_id, period_id, metric_id)` — **column order matters** for `onConflict`:
  ```ts
  .upsert(data, { onConflict: 'site_id,period_id,metric_id', ignoreDuplicates: false })
  ```
- In **edit mode**, identity dropdowns (Company/Site/Period/Dimension/Theme/Metric) are **locked** — only value/status/data_source/remark are editable
- Always log mutations via `useAuditLog().logActivity(...)` so the action appears in `audit_log`

### RLS / Auth

- RLS is enabled on every public table
- Client uses **anon key only** — never expose service_role
- Server-side admin actions (create/delete user, update password) go through **Edge Functions** in `supabase/functions/`
- For Edge Functions, `verify_jwt = false` is set in `config.toml` — they authenticate using the service_role key from env

### Foreign Keys

- All FKs are declared in DB (see `pg_constraint` for current list)
- If adding a new table, you **must** declare FKs to existing tables, OR PostgREST embedded queries (`*,foo:foo_id(...)`) will return 400
- After adding FKs, run `NOTIFY pgrst, 'reload schema';` to clear PostgREST cache (or wait ~30s)

### Migrations & Config

- Schema changes go through `supabase/migrations/<timestamp>_<name>.sql` then `supabase db push`
- For one-off SQL execution, use `supabase db query --linked -f <file.sql>` or Supabase MCP `execute_sql`
- SMTP / email template / Site URL changes go in `supabase/config.toml` → push with `SMTP_PASS=<key> supabase config push --yes`

---

## Auth & Routing

- Routes are declared in `src/App.tsx`
- Auth gating via `<ProtectedRoute allowedRoles={[...]}>` wrapper
- `useAuth()` provides: `user`, `profile`, `role`, `signIn`, `signUp`, `signOut`, `loading`
- After `auth.updateUser({ password })` (reset flow), **always call `auth.signOut()`** to force re-login with new password
- Reset flow uses `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/reset-password' })` — relies on `detectSessionInUrl: true` (default in supabase-js v2)

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| `onConflict` column order doesn't match unique constraint | Match exact order in constraint definition (`site_id,period_id,metric_id`) |
| PostgREST returns 400 on embedded query | Ensure FK exists between the two tables, then `NOTIFY pgrst, 'reload schema'` |
| Edit dialog allows changing Metric/Site/Period → duplicate key | Identity dropdowns must be `disabled={!!editingValue}` |
| Service role key bundled into client | Use only env vars prefixed `VITE_` for client; service role goes to Edge Functions only |
| Site URL in Supabase still `localhost:3000` after deploy | Set `site_url` in `config.toml` and `supabase config push` |
| Reset email goes to spam | Verify domain DKIM/SPF/MX records at the DNS provider |

---

## Build / Deploy Workflow

```bash
# Frontend
npm install
npm run build
firebase deploy --only hosting --project smartesg-af75b

# Edge Functions
supabase functions deploy <name> --project-ref zwzdhbttmtbkjyegsmzz

# Auth / SMTP / template config
SMTP_PASS='<resend-api-key>' supabase config push --yes

# Schema / data via SQL
supabase db query --linked -f path/to/file.sql
```

---

## Safety Checklist Before Committing

When an agent finishes a change, verify:

- [ ] Authorization from D2Infinite confirmed (for any code change)
- [ ] No service_role key, DB password, or API key committed to git
- [ ] `.env` is in `.gitignore`
- [ ] New tables have FKs declared
- [ ] New mutations call `logActivity(...)` to update `audit_log`
- [ ] New user-facing strings support TH + EN
- [ ] RLS policies are in place for any new table
- [ ] `npm run build` succeeds without errors
- [ ] Changes deploy cleanly to staging before production

---

## Out of Scope (Do NOT Touch Without Explicit Permission)

- License-related files
- `supabase/config.toml` `project_id`, SMTP credentials, sender email
- `firebase.json` / `.firebaserc` deployment targets
- Auth-related Edge Functions (`create-user`, `delete-user`, `update-password`)
- Audit log table or trigger logic
- Anything in `supabase/templates/`

---

## Contact / Authorization

For any modification request, contact: **D2Infinite Co.,Ltd.**
Authorization must be in writing (lay ลักษณ์อักษร) per the license.

---

© 2026 D2Infinite Co.,Ltd. All rights reserved.
