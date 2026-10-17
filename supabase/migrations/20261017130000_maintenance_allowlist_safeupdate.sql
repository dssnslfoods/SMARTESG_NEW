-- Fix: "21000 DELETE requires a WHERE clause".
-- PostgREST connections run with the safeupdate extension, which rejects a
-- bare DELETE. The allow-list reset must carry an explicit WHERE.
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

  DELETE FROM public.maintenance_allowed_user WHERE true;  -- safeupdate needs a WHERE

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
