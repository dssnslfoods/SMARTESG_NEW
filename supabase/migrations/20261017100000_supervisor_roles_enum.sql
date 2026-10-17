-- ─────────────────────────────────────────────────────────────────────────────
-- Split "supervisor" into two roles.
--   supervisor_global : tenant-wide overview + data entry, NO approval rights
--   supervisor_local  : approves/rejects staff entries for the site(s) assigned
--                       to them in supervisor_site
-- Enum values must be added in their own transaction before they can be used.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor_global';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor_local';
