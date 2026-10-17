-- Maintenance allow-list: any active user (not only admin-role) can be
-- allow-listed, so testers (staff / supervisor) can verify the system while
-- it is in maintenance mode. The candidate list now also returns the role.

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
          JOIN public.app_user_profile p ON p.user_id = m.user_id AND p.is_active
          WHERE m.user_id = _user_id
        )
      )
    );
$$;

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

  -- any active, non-super-admin user with a role
  INSERT INTO public.maintenance_allowed_user (user_id, added_by)
  SELECT DISTINCT r.user_id, auth.uid()
  FROM public.user_roles r
  JOIN public.app_user_profile p ON p.user_id = r.user_id
  WHERE p.is_active
    AND NOT public.is_super_admin(r.user_id)
    AND r.user_id = ANY (COALESCE(p_user_ids, '{}'));

  SELECT COALESCE(array_agg(user_id), '{}') INTO v_after FROM public.maintenance_allowed_user;

  PERFORM public.create_audit_log(
    'maintenance_allowlist_updated', 'maintenance_allowed_user', NULL,
    jsonb_build_object('user_ids', to_jsonb(v_before)),
    jsonb_build_object('user_ids', to_jsonb(v_after))
  );

  RETURN COALESCE(array_length(v_after, 1), 0);
END;
$$;

-- Return type changes (role added) → drop + recreate.
DROP FUNCTION IF EXISTS public.list_maintenance_admin_candidates();
CREATE FUNCTION public.list_maintenance_admin_candidates()
RETURNS TABLE (
  user_id     uuid,
  full_name   text,
  email       text,
  role        text,
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
    r.role::text,
    p.tenant_id,
    t.name,
    EXISTS (SELECT 1 FROM public.maintenance_allowed_user m WHERE m.user_id = r.user_id)
  FROM public.user_roles r
  JOIN public.app_user_profile p ON p.user_id = r.user_id
  LEFT JOIN auth.users u         ON u.id = r.user_id
  LEFT JOIN public.tenant t      ON t.tenant_id = p.tenant_id
  WHERE p.is_active
    AND NOT public.is_super_admin(r.user_id)
    AND public.is_super_admin(auth.uid())
  ORDER BY t.name NULLS LAST,
           CASE r.role::text
             WHEN 'admin' THEN 0 WHEN 'supervisor_global' THEN 1 WHEN 'supervisor_local' THEN 2
             WHEN 'executive' THEN 3 WHEN 'staff' THEN 4 ELSE 5 END,
           p.full_name NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.list_maintenance_admin_candidates() TO authenticated;

NOTIFY pgrst, 'reload schema';
