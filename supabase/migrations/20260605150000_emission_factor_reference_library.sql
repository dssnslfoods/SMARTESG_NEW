-- Reference library imported from Excel (lookup/suggestion source only — NOT the
-- factors the GHG calc uses). The active per-activity factors stay in
-- emission_factor (user-confirmed). Tenant-scoped.
CREATE TABLE IF NOT EXISTS public.emission_factor_reference (
  ref_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id(),
  activity_code text NOT NULL,
  activity_name_th text, activity_name_en text,
  scope int, factor numeric, unit text, source text,
  reference_detail text, effective_year int,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ref_id),
  UNIQUE (tenant_id, activity_code)
);
ALTER TABLE public.emission_factor_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS efr_select ON public.emission_factor_reference;
CREATE POLICY efr_select ON public.emission_factor_reference
  FOR SELECT USING (is_super_admin((select auth.uid())) OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS efr_write ON public.emission_factor_reference;
CREATE POLICY efr_write ON public.emission_factor_reference
  FOR ALL USING (is_super_admin((select auth.uid())) OR (tenant_id = current_tenant_id() AND (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))))
  WITH CHECK (is_super_admin((select auth.uid())) OR (tenant_id = current_tenant_id() AND (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))));
CREATE INDEX IF NOT EXISTS idx_emission_factor_reference_tenant ON public.emission_factor_reference(tenant_id);
