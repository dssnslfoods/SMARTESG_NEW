-- Staff may delete only their OWN entries that are not approved yet
-- (draft / submitted / rejected). Approved rows are already on the dashboards;
-- removing them needs a supervisor / admin, who are unaffected by this change.
DROP POLICY IF EXISTS metric_value_delete_merged ON public.metric_value;
CREATE POLICY metric_value_delete_merged ON public.metric_value
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id() AND (
      public.has_role((select auth.uid()), 'supervisor_global'::app_role) OR
      public.has_role((select auth.uid()), 'supervisor_local'::app_role) OR
      (
        public.has_role((select auth.uid()), 'staff'::app_role)
        AND submitted_by = (select auth.uid())
        AND status <> 'approved'
      )
    )
  );
