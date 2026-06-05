-- Perf (behaviour-preserving): wrap direct auth.uid()/auth.role()/auth.jwt()
-- calls inside every RLS policy in a scalar subselect so Postgres evaluates
-- them ONCE per query (InitPlan) instead of once per row. Boolean result of
-- each policy is identical — only evaluation timing changes. ALTER POLICY only;
-- no policy is dropped or has its roles/cmd changed.
DO $$
DECLARE r record; nq text; nc text; changed boolean;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check
           FROM pg_policies WHERE schemaname='public'
  LOOP
    nq := regexp_replace(coalesce(r.qual,''),       '\mauth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    nc := regexp_replace(coalesce(r.with_check,''), '\mauth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    changed := (r.qual IS NOT NULL AND nq <> r.qual) OR (r.with_check IS NOT NULL AND nc <> r.with_check);
    IF NOT changed THEN CONTINUE; END IF;
    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)', r.policyname, r.schemaname, r.tablename, nq, nc);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', r.policyname, r.schemaname, r.tablename, nq);
    ELSIF r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', r.policyname, r.schemaname, r.tablename, nc);
    END IF;
  END LOOP;
END $$;
