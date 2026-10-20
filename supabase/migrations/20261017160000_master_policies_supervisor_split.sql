-- Regression fix for the supervisor split.
-- Nine policies (master data, targets, app settings, emission-factor
-- reference) still tested the old 'supervisor' role. After every supervisor was
-- migrated to supervisor_local, neither supervisor_global nor supervisor_local
-- could write them (reads were unaffected). Both new roles get the rights the
-- old role had.
DO $$
DECLARE
  r     record;
  old_t text := 'has_role(( SELECT auth.uid() AS uid), ''supervisor''::app_role)';
  new_t text := '(has_role(( SELECT auth.uid() AS uid), ''supervisor_global''::app_role) OR has_role(( SELECT auth.uid() AS uid), ''supervisor_local''::app_role))';
  sql   text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%' || old_t || '%'
  LOOP
    sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF r.qual IS NOT NULL THEN
      sql := sql || format(' USING (%s)', replace(r.qual, old_t, new_t));
    END IF;
    IF r.with_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', replace(r.with_check, old_t, new_t));
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;
