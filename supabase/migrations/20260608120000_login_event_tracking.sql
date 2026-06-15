-- Records each successful user login for the User Analytics dashboard.
CREATE TABLE IF NOT EXISTS public.login_event (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id(),
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_login_event_tenant_time ON public.login_event(tenant_id, logged_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_event_user ON public.login_event(user_id, logged_in_at DESC);
ALTER TABLE public.login_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS login_event_insert ON public.login_event;
CREATE POLICY login_event_insert ON public.login_event FOR INSERT WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS login_event_select ON public.login_event;
CREATE POLICY login_event_select ON public.login_event FOR SELECT USING (is_super_admin((select auth.uid())) OR tenant_id = current_tenant_id());
