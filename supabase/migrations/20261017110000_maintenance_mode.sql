-- ─────────────────────────────────────────────────────────────────────────────
-- Maintenance Mode
--   Super admins can take the platform offline for upgrades. While enabled,
--   only super admins and the admin-role users explicitly allow-listed by a
--   super admin may use the system. Everyone else sees the "upgrading" page
--   and is blocked at the database layer by a RESTRICTIVE RLS policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_maintenance (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled      boolean NOT NULL DEFAULT false,
  message_th      text,
  message_en      text,
  expected_end_at timestamptz,
  enabled_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at      timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.system_maintenance (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.maintenance_allowed_user (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- ── Access check ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can read the tables above regardless of caller RLS.
-- true  : maintenance off, OR caller is super admin, OR caller is an active
--         admin on the allow-list.
CREATE OR REPLACE FUNCTION public.maintenance_access_allowed(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT COALESCE((SELECT is_enabled FROM public.system_maintenance WHERE id = 1), false)
    OR (
      _user_id IS NOT NULL
      AND (
        public.is_super_admin(_user_id)
        OR EXISTS (
          SELECT 1
          FROM public.maintenance_allowed_user m
          JOIN public.user_roles r      ON r.user_id = m.user_id AND r.role = 'admin'
          JOIN public.app_user_profile p ON p.user_id = m.user_id AND p.is_active
          WHERE m.user_id = _user_id
        )
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.maintenance_access_allowed(uuid) TO authenticated, anon;

-- ── RLS on the new tables ────────────────────────────────────────────────────
ALTER TABLE public.system_maintenance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_allowed_user ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_maintenance_select ON public.system_maintenance;
CREATE POLICY system_maintenance_select ON public.system_maintenance
  FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS system_maintenance_write ON public.system_maintenance;
CREATE POLICY system_maintenance_write ON public.system_maintenance
  FOR ALL TO authenticated
  USING (public.is_super_admin((select auth.uid())))
  WITH CHECK (public.is_super_admin((select auth.uid())));

DROP POLICY IF EXISTS maintenance_allowed_user_select ON public.maintenance_allowed_user;
CREATE POLICY maintenance_allowed_user_select ON public.maintenance_allowed_user
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_super_admin((select auth.uid())));
DROP POLICY IF EXISTS maintenance_allowed_user_write ON public.maintenance_allowed_user;
CREATE POLICY maintenance_allowed_user_write ON public.maintenance_allowed_user
  FOR ALL TO authenticated
  USING (public.is_super_admin((select auth.uid())))
  WITH CHECK (public.is_super_admin((select auth.uid())));

-- ── Realtime: clients subscribe so open sessions react instantly ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_maintenance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_maintenance;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'maintenance_allowed_user'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_allowed_user;
  END IF;
END $$;
ALTER TABLE public.maintenance_allowed_user REPLICA IDENTITY FULL;

-- ── RPCs ─────────────────────────────────────────────────────────────────────
-- Status for the current caller (one round-trip for the frontend).
CREATE OR REPLACE FUNCTION public.get_maintenance_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_enabled',      s.is_enabled,
    'message_th',      s.message_th,
    'message_en',      s.message_en,
    'expected_end_at', s.expected_end_at,
    'enabled_at',      s.enabled_at,
    'enabled_by_name', (SELECT full_name FROM public.app_user_profile WHERE user_id = s.enabled_by),
    'allowed_count',   (SELECT count(*) FROM public.maintenance_allowed_user),
    'access_allowed',  public.maintenance_access_allowed(auth.uid())
  )
  FROM public.system_maintenance s WHERE s.id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_maintenance_status() TO authenticated, anon;

-- Toggle maintenance mode (super admin only). Writes an audit_log row.
CREATE OR REPLACE FUNCTION public.set_maintenance_mode(
  p_enabled         boolean,
  p_message_th      text DEFAULT NULL,
  p_message_en      text DEFAULT NULL,
  p_expected_end_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can change maintenance mode' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s) INTO v_before FROM public.system_maintenance s WHERE id = 1;

  UPDATE public.system_maintenance
  SET is_enabled      = p_enabled,
      message_th      = p_message_th,
      message_en      = p_message_en,
      expected_end_at = p_expected_end_at,
      enabled_by      = CASE WHEN p_enabled THEN auth.uid() ELSE enabled_by END,
      enabled_at      = CASE WHEN p_enabled AND NOT is_enabled THEN now()
                             WHEN p_enabled THEN enabled_at
                             ELSE NULL END,
      updated_at      = now()
  WHERE id = 1;

  PERFORM public.create_audit_log(
    CASE WHEN p_enabled THEN 'maintenance_enabled' ELSE 'maintenance_disabled' END,
    'system_maintenance', '1', v_before,
    (SELECT to_jsonb(s) FROM public.system_maintenance s WHERE id = 1)
  );

  RETURN public.get_maintenance_status();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_maintenance_mode(boolean, text, text, timestamptz) TO authenticated;

-- Replace the allow-list (super admin only). Only active admin-role users are
-- accepted; anything else in p_user_ids is silently dropped.
CREATE OR REPLACE FUNCTION public.set_maintenance_allowed_users(p_user_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before uuid[];
  v_after  uuid[];
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can edit the maintenance allow-list' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(user_id), '{}') INTO v_before FROM public.maintenance_allowed_user;

  DELETE FROM public.maintenance_allowed_user;

  INSERT INTO public.maintenance_allowed_user (user_id, added_by)
  SELECT DISTINCT r.user_id, auth.uid()
  FROM public.user_roles r
  JOIN public.app_user_profile p ON p.user_id = r.user_id
  WHERE r.role = 'admin' AND p.is_active AND r.user_id = ANY (COALESCE(p_user_ids, '{}'));

  SELECT COALESCE(array_agg(user_id), '{}') INTO v_after FROM public.maintenance_allowed_user;

  PERFORM public.create_audit_log(
    'maintenance_allowlist_updated', 'maintenance_allowed_user', NULL,
    jsonb_build_object('user_ids', to_jsonb(v_before)),
    jsonb_build_object('user_ids', to_jsonb(v_after))
  );

  RETURN COALESCE(array_length(v_after, 1), 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_maintenance_allowed_users(uuid[]) TO authenticated;

-- Candidate list for the allow-list UI: every active admin across tenants.
CREATE OR REPLACE FUNCTION public.list_maintenance_admin_candidates()
RETURNS TABLE (
  user_id     uuid,
  full_name   text,
  email       text,
  tenant_id   uuid,
  tenant_name text,
  is_allowed  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.user_id,
    p.full_name,
    u.email::text,
    p.tenant_id,
    t.name,
    EXISTS (SELECT 1 FROM public.maintenance_allowed_user m WHERE m.user_id = r.user_id)
  FROM public.user_roles r
  JOIN public.app_user_profile p ON p.user_id = r.user_id
  LEFT JOIN auth.users u         ON u.id = r.user_id
  LEFT JOIN public.tenant t      ON t.tenant_id = p.tenant_id
  WHERE r.role = 'admin'
    AND p.is_active
    AND public.is_super_admin(auth.uid())
  ORDER BY t.name NULLS LAST, p.full_name NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.list_maintenance_admin_candidates() TO authenticated;

-- ── Server-side enforcement ──────────────────────────────────────────────────
-- A RESTRICTIVE policy is AND-ed with every existing permissive policy, so a
-- blocked user cannot read or write application data by calling the API
-- directly. Tables needed to bootstrap auth/role lookup and to render the
-- maintenance page itself are excluded.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relname NOT IN (
        'system_maintenance', 'maintenance_allowed_user',
        'user_roles', 'super_admin', 'app_user_profile',
        'tenant', 'audit_log', 'login_event'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS maintenance_block ON public.%I', r.relname);
    EXECUTE format(
      'CREATE POLICY maintenance_block ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (public.maintenance_access_allowed((select auth.uid()))) '
      'WITH CHECK (public.maintenance_access_allowed((select auth.uid())))',
      r.relname
    );
  END LOOP;
END $$;
