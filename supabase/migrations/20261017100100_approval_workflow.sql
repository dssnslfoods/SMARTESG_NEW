-- ─────────────────────────────────────────────────────────────────────────────
-- Approval workflow for metric_value + supervisor_global / supervisor_local
--
--   staff ──submit──▶ submitted ──approve (supervisor_local)──▶ approved ──▶ dashboards
--                         │
--                         └──reject + reason──▶ rejected ──staff edits & resubmits──▶ submitted
--
-- * supervisor_local reviews only the sites listed for them in supervisor_site
--   (fallback: their profile site when they have no rows there).
-- * Dashboards / reports / RPCs count ONLY status = 'approved'.
-- * approved / rejected can only be set through review_metric_values() (or by
--   admin / super_admin); a BEFORE trigger blocks every other path.
-- * Editing an approved row sends it back to 'submitted' for re-approval.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.metric_value
  ADD COLUMN IF NOT EXISTS submitted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note    text,
  ADD COLUMN IF NOT EXISTS rejected_by      uuid,
  ADD COLUMN IF NOT EXISTS rejected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_metric_value_status_site
  ON public.metric_value (tenant_id, status, site_id);

-- ── 2. supervisor_site — which sites a supervisor_local may review ───────────
CREATE TABLE IF NOT EXISTS public.supervisor_site (
  tenant_id  uuid NOT NULL DEFAULT public.default_tenant_id()
             REFERENCES public.tenant(tenant_id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  site_id    text NOT NULL REFERENCES public.site(site_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_supervisor_site_tenant_user
  ON public.supervisor_site (tenant_id, user_id);

ALTER TABLE public.supervisor_site ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supervisor_site_select ON public.supervisor_site;
CREATE POLICY supervisor_site_select ON public.supervisor_site
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
         OR (select public.is_super_admin((select auth.uid()))));

-- Admin / super_admin / supervisor_global manage assignments (same people who
-- manage users today).
DROP POLICY IF EXISTS supervisor_site_manage ON public.supervisor_site;
CREATE POLICY supervisor_site_manage ON public.supervisor_site
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'admin'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      (select public.is_super_admin((select auth.uid())))
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'admin'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      (select public.is_super_admin((select auth.uid())))
    )
  );

-- ── 3. Helper: can this user review entries for this site? ───────────────────
CREATE OR REPLACE FUNCTION public.can_review_site(_user_id uuid, _site_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'supervisor_local')
      AND (
        EXISTS (SELECT 1 FROM public.supervisor_site WHERE user_id = _user_id AND site_id = _site_id)
        OR (
          NOT EXISTS (SELECT 1 FROM public.supervisor_site WHERE user_id = _user_id)
          AND public.get_user_site(_user_id) = _site_id
        )
      )
    );
$$;

-- Sites the current user may review (used by the Approvals page filter).
CREATE OR REPLACE FUNCTION public.my_reviewable_sites()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.site_id
  FROM public.site s
  WHERE s.tenant_id = public.current_tenant_id()
    AND public.can_review_site((select auth.uid()), s.site_id);
$$;

-- ── 4. Status guard trigger ──────────────────────────────────────────────────
-- Only review_metric_values() (which sets app.review_bypass) or admin /
-- super_admin may write 'approved' / 'rejected'. Any content edit to an
-- approved row drops it back to 'submitted' so it must be re-approved.
CREATE OR REPLACE FUNCTION public.metric_value_status_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bypass   boolean := coalesce(current_setting('app.review_bypass', true), '') = '1';
  v_uid      uuid    := auth.uid();
  v_is_admin boolean;
  v_changed  boolean;
BEGIN
  IF v_bypass THEN
    RETURN NEW;
  END IF;

  v_is_admin := v_uid IS NOT NULL AND (
    public.is_super_admin(v_uid)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin')
  );

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('approved', 'rejected') AND NOT v_is_admin THEN
      RAISE EXCEPTION 'metric_value: status % can only be set through the review workflow', NEW.status
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'submitted' THEN NEW.submitted_at := now(); END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_changed := NEW.value IS DISTINCT FROM OLD.value
            OR NEW.metric_id IS DISTINCT FROM OLD.metric_id
            OR NEW.site_id   IS DISTINCT FROM OLD.site_id
            OR NEW.period_id IS DISTINCT FROM OLD.period_id;

  -- Direct approve / reject outside the RPC → admins only
  IF NEW.status IN ('approved', 'rejected')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT v_is_admin THEN
    RAISE EXCEPTION 'metric_value: status % can only be set through the review workflow', NEW.status
      USING ERRCODE = '42501';
  END IF;

  -- Content edit on an approved row → needs re-approval
  IF OLD.status = 'approved' AND NEW.status = 'approved' AND v_changed AND NOT v_is_admin THEN
    NEW.status := 'submitted';
  END IF;

  -- Leaving approved / rejected → clear reviewer stamps
  IF NEW.status IN ('draft', 'submitted') AND OLD.status IN ('approved', 'rejected') THEN
    NEW.approved_by   := NULL;
    NEW.approved_at   := NULL;
    NEW.approval_note := NULL;
    -- keep rejected_* + rejection_reason as history until the next approval
  END IF;

  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_metric_value_status_guard ON public.metric_value;
CREATE TRIGGER trg_metric_value_status_guard
  BEFORE INSERT OR UPDATE ON public.metric_value
  FOR EACH ROW EXECUTE FUNCTION public.metric_value_status_guard();

-- ── 5. Review RPC (approve / reject one or many rows) ────────────────────────
CREATE OR REPLACE FUNCTION public.review_metric_values(
  p_value_ids text[],
  p_action    text,            -- 'approve' | 'reject'
  p_reason    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_tid    uuid := public.current_tenant_id();
  v_row    public.metric_value%ROWTYPE;
  v_id     text;
  v_done   int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR v_tid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action %', p_action;
  END IF;
  IF p_action = 'reject' AND coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when rejecting';
  END IF;

  PERFORM set_config('app.review_bypass', '1', true);

  FOREACH v_id IN ARRAY p_value_ids LOOP
    SELECT * INTO v_row FROM public.metric_value
     WHERE value_id = v_id AND tenant_id = v_tid FOR UPDATE;

    IF NOT FOUND THEN
      v_errors := v_errors || jsonb_build_object('value_id', v_id, 'error', 'not_found');
      CONTINUE;
    END IF;
    IF NOT public.can_review_site(v_uid, v_row.site_id) THEN
      v_errors := v_errors || jsonb_build_object('value_id', v_id, 'error', 'forbidden');
      CONTINUE;
    END IF;
    IF v_row.status <> 'submitted' THEN
      v_errors := v_errors || jsonb_build_object('value_id', v_id, 'error', 'not_submitted', 'status', v_row.status);
      CONTINUE;
    END IF;

    IF p_action = 'approve' THEN
      UPDATE public.metric_value SET
        status           = 'approved',
        approved_by      = v_uid,
        approved_at      = now(),
        approval_note    = nullif(btrim(p_reason), ''),
        rejected_by      = NULL,
        rejected_at      = NULL,
        rejection_reason = NULL
      WHERE value_id = v_id;
    ELSE
      UPDATE public.metric_value SET
        status           = 'rejected',
        rejected_by      = v_uid,
        rejected_at      = now(),
        rejection_reason = btrim(p_reason),
        approved_by      = NULL,
        approved_at      = NULL,
        approval_note    = NULL
      WHERE value_id = v_id;
    END IF;

    PERFORM public.create_audit_log(
      CASE WHEN p_action = 'approve' THEN 'APPROVE' ELSE 'REJECT' END,
      'metric_value',
      v_id,
      to_jsonb(v_row),
      (SELECT to_jsonb(m) FROM public.metric_value m WHERE m.value_id = v_id)
    );
    v_done := v_done + 1;
  END LOOP;

  PERFORM set_config('app.review_bypass', '', true);

  RETURN jsonb_build_object('processed', v_done, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.review_metric_values(text[], text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.review_metric_values(text[], text, text) TO authenticated;

-- ── 6. Dashboard counters now include approval states ────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_metric_stats()
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total',          count(*),
    'draft',          count(*) FILTER (WHERE status = 'draft'),
    'submitted',      count(*) FILTER (WHERE status = 'submitted'),
    'approved',       count(*) FILTER (WHERE status = 'approved'),
    'rejected',       count(*) FILTER (WHERE status = 'rejected'),
    'my_drafts',      count(*) FILTER (WHERE status = 'draft'     AND submitted_by = (select auth.uid())),
    'my_submitted',   count(*) FILTER (WHERE status = 'submitted' AND submitted_by = (select auth.uid())),
    'my_rejected',    count(*) FILTER (WHERE status = 'rejected'  AND submitted_by = (select auth.uid())),
    'pending_review', count(*) FILTER (WHERE status = 'submitted'
                                         AND site_id IN (SELECT public.my_reviewable_sites()))
  )
  FROM public.metric_value;
$$;

-- ── 7. GHG auto-calc rows inherit the "weakest" status of their inputs ───────
CREATE OR REPLACE FUNCTION public.recompute_ghg_target(p_tenant uuid, p_site text, p_period text, p_target_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_metric text;
  v_total_kg numeric;
  v_status   text;
  v_value_id text;
  v_rows     int;
BEGIN
  SELECT metric_id INTO v_target_metric
  FROM esg_metric
  WHERE tenant_id = p_tenant AND code = p_target_code AND calc_mode = 'auto'
  LIMIT 1;
  IF v_target_metric IS NULL THEN RETURN; END IF;

  SELECT
    coalesce(sum(mv.value * ef.factor_value), 0),
    -- draft > rejected > submitted > approved (weakest input wins)
    CASE WHEN bool_or(mv.status = 'draft')     THEN 'draft'
         WHEN bool_or(mv.status = 'rejected')  THEN 'rejected'
         WHEN bool_and(mv.status = 'approved') THEN 'approved'
         ELSE 'submitted' END,
    count(*)
  INTO v_total_kg, v_status, v_rows
  FROM ghg_calc_mapping m
  JOIN esg_metric sm      ON sm.tenant_id = p_tenant AND sm.code = m.source_code
  JOIN emission_factor ef ON ef.tenant_id = p_tenant AND ef.source_code = m.source_code
  JOIN metric_value mv    ON mv.tenant_id = p_tenant AND mv.metric_id = sm.metric_id
                          AND mv.site_id = p_site AND mv.period_id = p_period
  WHERE m.tenant_id = p_tenant AND m.target_code = p_target_code;

  IF v_rows = 0 THEN RETURN; END IF;

  v_value_id := 'AUTO-' || v_target_metric || '-' || p_site || '-' || p_period;

  -- derived row: skip the status guard (it mirrors already-reviewed inputs)
  PERFORM set_config('app.review_bypass', '1', true);
  INSERT INTO metric_value (value_id, metric_id, site_id, period_id, value, status, data_source, tenant_id)
  VALUES (v_value_id, v_target_metric, p_site, p_period, round(v_total_kg / 1000.0, 3),
          v_status, 'Auto-calculated (GHG)', p_tenant)
  ON CONFLICT (site_id, period_id, metric_id)
  DO UPDATE SET value = EXCLUDED.value, status = EXCLUDED.status,
                data_source = 'Auto-calculated (GHG)', updated_at = now(), last_updated = now();
  PERFORM set_config('app.review_bypass', '', true);
END $$;

-- ── 8. Executive / GHG summaries read approved data only ─────────────────────
-- (function bodies unchanged apart from status = 'approved')
DO $$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_executive_summary';
  IF src IS NOT NULL THEN
    EXECUTE replace(src, 'v.status = ''submitted''', 'v.status = ''approved''');
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_ghg_summary';
  IF src IS NOT NULL THEN
    EXECUTE replace(src, 'v.status = ''submitted''', 'v.status = ''approved''');
  END IF;
END $$;

-- ── 9. RLS on metric_value ───────────────────────────────────────────────────
DROP POLICY IF EXISTS metric_value_select_combined      ON public.metric_value;
DROP POLICY IF EXISTS metric_value_update_merged        ON public.metric_value;
DROP POLICY IF EXISTS metric_value_delete_merged        ON public.metric_value;
DROP POLICY IF EXISTS "Users can insert metric values"  ON public.metric_value;

-- SELECT: managers see the whole tenant; staff see own rows + approved rows.
CREATE POLICY metric_value_select_combined ON public.metric_value
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'admin'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_local'::app_role) OR
      public.has_role((select auth.uid()), 'executive'::app_role) OR
      submitted_by = (select auth.uid()) OR
      status = 'approved'
    )
  );

-- INSERT: admin + both supervisors anywhere in tenant; staff own rows, draft/submitted only
CREATE POLICY "Users can insert metric values" ON public.metric_value
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'admin'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_local'::app_role) OR
      (
        public.has_role((select auth.uid()), 'staff'::app_role)
        AND submitted_by = (select auth.uid())
        AND status IN ('draft', 'submitted')
      )
    )
  );

-- UPDATE: staff own rows (may only land in draft/submitted — i.e. edit + resubmit);
-- supervisors tenant-wide (approve/reject itself goes through the RPC + trigger guard)
CREATE POLICY metric_value_update_merged ON public.metric_value
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_local'::app_role) OR
      (public.has_role((select auth.uid()), 'staff'::app_role) AND submitted_by = (select auth.uid()))
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_local'::app_role) OR
      (
        public.has_role((select auth.uid()), 'staff'::app_role)
        AND submitted_by = (select auth.uid())
        AND status IN ('draft', 'submitted')
      )
    )
  );

CREATE POLICY metric_value_delete_merged ON public.metric_value
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_local'::app_role) OR
      (public.has_role((select auth.uid()), 'staff'::app_role) AND submitted_by = (select auth.uid()))
    )
  );

-- ── 10. user_roles / app_user_profile: both supervisors keep user-management ──
DROP POLICY IF EXISTS "Supervisors can view all roles"        ON public.user_roles;
DROP POLICY IF EXISTS "Supervisors can insert roles"          ON public.user_roles;
DROP POLICY IF EXISTS "Supervisors can update roles"          ON public.user_roles;
CREATE POLICY "Supervisors can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role((select auth.uid()), 'supervisor_global'::app_role)
           OR public.has_role((select auth.uid()), 'supervisor_local'::app_role))
         AND NOT public.is_super_admin(user_id));
CREATE POLICY "Supervisors can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
         AND (public.has_role((select auth.uid()), 'supervisor_global'::app_role)
           OR public.has_role((select auth.uid()), 'supervisor_local'::app_role)));
CREATE POLICY "Supervisors can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role((select auth.uid()), 'supervisor_global'::app_role)
           OR public.has_role((select auth.uid()), 'supervisor_local'::app_role)));

DROP POLICY IF EXISTS "Supervisors can view all profiles"     ON public.app_user_profile;
DROP POLICY IF EXISTS "Supervisors can insert profiles"       ON public.app_user_profile;
DROP POLICY IF EXISTS "Supervisors can update all profiles"   ON public.app_user_profile;
CREATE POLICY "Supervisors can view all profiles" ON public.app_user_profile
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role((select auth.uid()), 'supervisor_global'::app_role)
           OR public.has_role((select auth.uid()), 'supervisor_local'::app_role))
         AND NOT public.is_super_admin(user_id));
CREATE POLICY "Supervisors can insert profiles" ON public.app_user_profile
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
         AND (public.has_role((select auth.uid()), 'supervisor_global'::app_role)
           OR public.has_role((select auth.uid()), 'supervisor_local'::app_role)));
CREATE POLICY "Supervisors can update all profiles" ON public.app_user_profile
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role((select auth.uid()), 'supervisor_global'::app_role)
           OR public.has_role((select auth.uid()), 'supervisor_local'::app_role)));

-- ── 11. Permission tables: accept the new roles + seed from old supervisor ───
ALTER TABLE public.menu_permission DROP CONSTRAINT IF EXISTS menu_permission_role_check;
ALTER TABLE public.menu_permission ADD CONSTRAINT menu_permission_role_check
  CHECK (role = ANY (ARRAY['supervisor','supervisor_global','supervisor_local','executive','staff','guest']));

INSERT INTO public.menu_permission (tenant_id, menu_key, role, is_active)
SELECT tenant_id, menu_key, r, is_active
FROM public.menu_permission, unnest(ARRAY['supervisor_global','supervisor_local']) AS r
WHERE role = 'supervisor'
ON CONFLICT (tenant_id, menu_key, role) DO NOTHING;

-- New "Approvals" menu: supervisor_local on by default, everyone else off
INSERT INTO public.menu_permission (tenant_id, menu_key, role, is_active)
SELECT t.tenant_id, 'approvals', r, (r = 'supervisor_local')
FROM public.tenant t, unnest(ARRAY['supervisor_global','supervisor_local','executive','staff','guest']) AS r
ON CONFLICT (tenant_id, menu_key, role) DO NOTHING;

INSERT INTO public.data_entry_permission (tenant_id, role, can_create, create_scope, edit_scope, delete_scope)
SELECT tenant_id, r::app_role, can_create, create_scope, edit_scope, delete_scope
FROM public.data_entry_permission, unnest(ARRAY['supervisor_global','supervisor_local']) AS r
WHERE role = 'supervisor'
ON CONFLICT (tenant_id, role) DO NOTHING;

-- ── 12. Data migration ───────────────────────────────────────────────────────
-- Existing supervisors → supervisor_local (their profile site is their review
-- scope until an admin assigns more sites in supervisor_site).
UPDATE public.user_roles SET role = 'supervisor_local' WHERE role = 'supervisor';

INSERT INTO public.supervisor_site (tenant_id, user_id, site_id)
SELECT p.tenant_id, p.user_id, p.site_id
FROM public.app_user_profile p
JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'supervisor_local'
WHERE p.site_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Everything already 'submitted' before the workflow existed is treated as
-- reviewed so dashboards keep showing historical data.
-- Triggers are paused so last_updated stays untouched and the GHG auto-rows
-- are not recomputed 6,000+ times (they are backfilled by this same UPDATE).
ALTER TABLE public.metric_value DISABLE TRIGGER trg_metric_value_ts;
ALTER TABLE public.metric_value DISABLE TRIGGER recompute_ghg_after_change;
ALTER TABLE public.metric_value DISABLE TRIGGER trg_metric_value_status_guard;
UPDATE public.metric_value
SET status        = 'approved',
    approved_at   = now(),
    approval_note = 'auto-approved (approval workflow migration)'
WHERE status = 'submitted';
ALTER TABLE public.metric_value ENABLE TRIGGER trg_metric_value_ts;
ALTER TABLE public.metric_value ENABLE TRIGGER recompute_ghg_after_change;
ALTER TABLE public.metric_value ENABLE TRIGGER trg_metric_value_status_guard;

NOTIFY pgrst, 'reload schema';
