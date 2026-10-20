-- supervisor_local may create / edit / delete ESG entries only inside the sites
-- they can review (supervisor_site; fallback: own profile site), the same scope
-- as their approval rights. supervisor_global, admin and staff rules are
-- unchanged. SELECT stays tenant-wide so they can still see every site.
-- can_review_site() is also checked on the NEW row, so an entry cannot be
-- moved into a site outside the scope.
DROP POLICY IF EXISTS "Users can insert metric values" ON public.metric_value;
CREATE POLICY "Users can insert metric values" ON public.metric_value
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'admin'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      (public.has_role((select auth.uid()), 'supervisor_local'::app_role)
        AND public.can_review_site((select auth.uid()), site_id)) OR
      (
        public.has_role((select auth.uid()), 'staff'::app_role)
        AND submitted_by = (select auth.uid())
        AND status IN ('draft', 'submitted')
      )
    )
  );

DROP POLICY IF EXISTS metric_value_update_merged ON public.metric_value;
CREATE POLICY metric_value_update_merged ON public.metric_value
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      (public.has_role((select auth.uid()), 'supervisor_local'::app_role)
        AND public.can_review_site((select auth.uid()), site_id)) OR
      (public.has_role((select auth.uid()), 'staff'::app_role) AND submitted_by = (select auth.uid()))
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      (public.has_role((select auth.uid()), 'supervisor_local'::app_role)
        AND public.can_review_site((select auth.uid()), site_id)) OR
      (
        public.has_role((select auth.uid()), 'staff'::app_role)
        AND submitted_by = (select auth.uid())
        AND status IN ('draft', 'submitted')
      )
    )
  );

DROP POLICY IF EXISTS metric_value_delete_merged ON public.metric_value;
CREATE POLICY metric_value_delete_merged ON public.metric_value
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      (public.has_role((select auth.uid()), 'supervisor_local'::app_role)
        AND public.can_review_site((select auth.uid()), site_id)) OR
      (
        public.has_role((select auth.uid()), 'staff'::app_role)
        AND submitted_by = (select auth.uid())
        AND status <> 'approved'
      )
    )
  );
