
CREATE TABLE IF NOT EXISTS public.app_setting (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_setting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
  ON public.app_setting FOR SELECT
  TO authenticated
  USING (is_user_active(auth.uid()));

CREATE POLICY "Admins can manage settings"
  ON public.app_setting FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to settings"
  ON public.app_setting FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER trg_app_setting_updated
BEFORE UPDATE ON public.app_setting
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_setting (key, value)
VALUES ('data_entry_page_size', '15')
ON CONFLICT (key) DO NOTHING;
