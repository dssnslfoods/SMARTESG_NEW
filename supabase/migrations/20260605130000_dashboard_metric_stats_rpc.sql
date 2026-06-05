-- Server-side dashboard counters (SECURITY INVOKER → RLS applies per role/tenant).
-- Replaces streaming every visible metric_value row to the browser just to count.
CREATE OR REPLACE FUNCTION public.get_dashboard_metric_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'total',        count(*),
    'draft',        count(*) FILTER (WHERE status = 'draft'),
    'submitted',    count(*) FILTER (WHERE status = 'submitted'),
    'my_drafts',    count(*) FILTER (WHERE status = 'draft'     AND submitted_by = (select auth.uid())),
    'my_submitted', count(*) FILTER (WHERE status = 'submitted' AND submitted_by = (select auth.uid()))
  )
  FROM public.metric_value;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metric_stats() TO authenticated;
