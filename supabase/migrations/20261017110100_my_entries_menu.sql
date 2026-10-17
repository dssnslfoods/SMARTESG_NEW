-- "My Entries" menu (staff tracks the approval status of their own rows).
-- Applied to the live DB on 2026-10-17 via MCP; kept here for db push parity.
INSERT INTO public.menu_permission (tenant_id, menu_key, role, is_active)
SELECT t.tenant_id, 'my-entries', r, (r IN ('staff','supervisor_global','supervisor_local'))
FROM public.tenant t, unnest(ARRAY['supervisor_global','supervisor_local','executive','staff','guest']) AS r
ON CONFLICT (tenant_id, menu_key, role) DO NOTHING;
