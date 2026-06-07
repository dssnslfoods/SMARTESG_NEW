-- Additive metadata columns for Excel import/export of emission factors.
-- Nullable/defaulted — the GHG calc (joins on tenant_id+source_code, reads
-- factor_value) is unaffected.
ALTER TABLE public.emission_factor
  ADD COLUMN IF NOT EXISTS activity_name_th text,
  ADD COLUMN IF NOT EXISTS activity_name_en text,
  ADD COLUMN IF NOT EXISTS reference_detail text,
  ADD COLUMN IF NOT EXISTS effective_year   int,
  ADD COLUMN IF NOT EXISTS active            boolean NOT NULL DEFAULT true;
