-- Perf (pure add): covering indexes for previously-unindexed foreign keys.
-- Cannot change query results or permissions — only speeds FK joins/cascades.
CREATE INDEX IF NOT EXISTS idx_app_setting_updated_by           ON public.app_setting(updated_by);
CREATE INDEX IF NOT EXISTS idx_app_user_profile_company_id      ON public.app_user_profile(company_id);
CREATE INDEX IF NOT EXISTS idx_app_user_profile_site_id         ON public.app_user_profile(site_id);
CREATE INDEX IF NOT EXISTS idx_metric_target_created_by         ON public.metric_target(created_by);
CREATE INDEX IF NOT EXISTS idx_metric_value_metric_id           ON public.metric_value(metric_id);
CREATE INDEX IF NOT EXISTS idx_metric_value_submitted_by        ON public.metric_value(submitted_by);
CREATE INDEX IF NOT EXISTS idx_metric_value_approved_by         ON public.metric_value(approved_by);
CREATE INDEX IF NOT EXISTS idx_metric_value_period_id           ON public.metric_value(period_id);
CREATE INDEX IF NOT EXISTS idx_site_company_id                  ON public.site(company_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_granted_by           ON public.super_admin(granted_by);
CREATE INDEX IF NOT EXISTS idx_tenant_menu_allowlist_updated_by ON public.tenant_menu_allowlist(updated_by);
