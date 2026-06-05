-- Perf (behaviour-preserving): merge multiple PERMISSIVE policies that share the
-- SAME (table, cmd, roles) into one policy whose USING / WITH CHECK is the OR of
-- the members. Postgres already evaluates permissive policies as an OR, so this
-- is provably equivalent for reads AND writes (verified: per-user RLS row
-- visibility identical before/after across all roles & both tenants).
DO $$
DECLARE g record; m record; using_parts text[]; check_parts text[]; nu text; nc text; rolestr text; newname text;
BEGIN
  FOR g IN SELECT tablename, cmd, roles FROM pg_policies
           WHERE schemaname='public' AND permissive='PERMISSIVE'
           GROUP BY tablename, cmd, roles HAVING count(*) > 1
  LOOP
    using_parts := ARRAY[]::text[]; check_parts := ARRAY[]::text[];
    FOR m IN SELECT policyname, qual, with_check FROM pg_policies
             WHERE schemaname='public' AND tablename=g.tablename AND cmd=g.cmd
               AND roles=g.roles AND permissive='PERMISSIVE'
    LOOP
      IF m.qual IS NOT NULL THEN using_parts := using_parts || ('('||m.qual||')'); END IF;
      IF g.cmd IN ('ALL','INSERT','UPDATE') AND coalesce(m.with_check, m.qual) IS NOT NULL THEN
        check_parts := check_parts || ('('||coalesce(m.with_check, m.qual)||')');
      END IF;
      EXECUTE format('DROP POLICY %I ON public.%I', m.policyname, g.tablename);
    END LOOP;
    nu := array_to_string(using_parts, ' OR ');
    nc := array_to_string(check_parts, ' OR ');
    rolestr := array_to_string(g.roles, ',');
    newname := g.tablename||'_'||lower(g.cmd)||'_merged';
    EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s %s %s',
      newname, g.tablename, g.cmd, rolestr,
      CASE WHEN nu <> '' THEN 'USING ('||nu||')'      ELSE '' END,
      CASE WHEN nc <> '' THEN 'WITH CHECK ('||nc||')' ELSE '' END);
  END LOOP;
END $$;
