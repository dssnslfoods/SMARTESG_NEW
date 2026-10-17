-- ─────────────────────────────────────────────────────────────────────────────
-- Review context for the Approvals page.
-- For each metric_value row returns the approved history of the same
-- site + metric (previous month, 3/6-month averages, same month last year,
-- last 12 periods) plus a deviation assessment so a supervisor can judge an
-- entry — and so a reject reason can be pre-filled when a value looks wrong.
-- Only approved rows form the baseline. Callers must be able to review the
-- row's site, or be its submitter.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_review_context(p_value_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tid uuid := public.current_tenant_id();
  v_out jsonb := '[]'::jsonb;
  r     record;
  cur_y int; cur_m int; cur_idx int;
  prev_val numeric; prev_label text;
  avg3 numeric; n3 int; avg6 numeric; n6 int;
  ly_val numeric;
  mean12 numeric; sd12 numeric; n12 int;
  hist jsonb;
  mom_pct numeric; dev3_pct numeric; dev6_pct numeric; yoy_pct numeric; z numeric;
  flags jsonb; level text;
BEGIN
  IF v_uid IS NULL OR v_tid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT mv.value_id, mv.site_id, mv.metric_id, mv.period_id, mv.value, mv.submitted_by,
           rp.year, rp.month, m.aggregation, m.unit
    FROM public.metric_value mv
    JOIN public.reporting_period rp ON rp.period_id = mv.period_id
    JOIN public.esg_metric m        ON m.metric_id  = mv.metric_id
    WHERE mv.tenant_id = v_tid AND mv.value_id = ANY (p_value_ids)
  LOOP
    IF NOT (public.can_review_site(v_uid, r.site_id) OR r.submitted_by = v_uid) THEN
      CONTINUE;
    END IF;

    cur_y := r.year; cur_m := r.month; cur_idx := cur_y * 12 + cur_m;

    -- previous period (immediately preceding month that has an approved value)
    SELECT v.value, rp.month_name || ' ' || rp.year
      INTO prev_val, prev_label
    FROM public.metric_value v JOIN public.reporting_period rp ON rp.period_id = v.period_id
    WHERE v.tenant_id = v_tid AND v.site_id = r.site_id AND v.metric_id = r.metric_id
      AND v.status = 'approved' AND (rp.year * 12 + rp.month) = cur_idx - 1
    LIMIT 1;

    SELECT avg(v.value), count(*) INTO avg3, n3
    FROM public.metric_value v JOIN public.reporting_period rp ON rp.period_id = v.period_id
    WHERE v.tenant_id = v_tid AND v.site_id = r.site_id AND v.metric_id = r.metric_id
      AND v.status = 'approved'
      AND (rp.year * 12 + rp.month) BETWEEN cur_idx - 3 AND cur_idx - 1;

    SELECT avg(v.value), count(*) INTO avg6, n6
    FROM public.metric_value v JOIN public.reporting_period rp ON rp.period_id = v.period_id
    WHERE v.tenant_id = v_tid AND v.site_id = r.site_id AND v.metric_id = r.metric_id
      AND v.status = 'approved'
      AND (rp.year * 12 + rp.month) BETWEEN cur_idx - 6 AND cur_idx - 1;

    SELECT v.value INTO ly_val
    FROM public.metric_value v JOIN public.reporting_period rp ON rp.period_id = v.period_id
    WHERE v.tenant_id = v_tid AND v.site_id = r.site_id AND v.metric_id = r.metric_id
      AND v.status = 'approved' AND rp.year = cur_y - 1 AND rp.month = cur_m
    LIMIT 1;

    SELECT avg(v.value), stddev_samp(v.value), count(*) INTO mean12, sd12, n12
    FROM public.metric_value v JOIN public.reporting_period rp ON rp.period_id = v.period_id
    WHERE v.tenant_id = v_tid AND v.site_id = r.site_id AND v.metric_id = r.metric_id
      AND v.status = 'approved'
      AND (rp.year * 12 + rp.month) BETWEEN cur_idx - 12 AND cur_idx - 1;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'period_id', rp.period_id, 'year', rp.year, 'month', rp.month,
             'label', rp.month_name || ' ' || rp.year,
             'value', v.value, 'status', v.status,
             'is_current', v.value_id = r.value_id
           ) ORDER BY rp.year, rp.month), '[]'::jsonb)
      INTO hist
    FROM public.metric_value v JOIN public.reporting_period rp ON rp.period_id = v.period_id
    WHERE v.tenant_id = v_tid AND v.site_id = r.site_id AND v.metric_id = r.metric_id
      AND (v.status = 'approved' OR v.value_id = r.value_id)
      AND (rp.year * 12 + rp.month) BETWEEN cur_idx - 12 AND cur_idx;

    mom_pct  := CASE WHEN prev_val IS NOT NULL AND prev_val <> 0 THEN round((r.value - prev_val) / abs(prev_val) * 100, 1) END;
    dev3_pct := CASE WHEN avg3 IS NOT NULL AND avg3 <> 0 THEN round((r.value - avg3) / abs(avg3) * 100, 1) END;
    dev6_pct := CASE WHEN avg6 IS NOT NULL AND avg6 <> 0 THEN round((r.value - avg6) / abs(avg6) * 100, 1) END;
    yoy_pct  := CASE WHEN ly_val IS NOT NULL AND ly_val <> 0 THEN round((r.value - ly_val) / abs(ly_val) * 100, 1) END;
    z        := CASE WHEN sd12 IS NOT NULL AND sd12 > 0 AND n12 >= 3 THEN round((r.value - mean12) / sd12, 2) END;

    -- Deviation assessment. Each flag is structured; the UI renders TH/EN text.
    flags := '[]'::jsonb;
    IF mom_pct IS NOT NULL AND abs(mom_pct) >= 50 THEN
      flags := flags || jsonb_build_object('type','mom','pct',mom_pct,'ref',prev_val,'ref_label',prev_label);
    END IF;
    IF dev3_pct IS NOT NULL AND n3 >= 2 AND abs(dev3_pct) >= 50 THEN
      flags := flags || jsonb_build_object('type','avg3','pct',dev3_pct,'ref',round(avg3,3),'n',n3);
    END IF;
    IF dev6_pct IS NOT NULL AND n6 >= 3 AND abs(dev6_pct) >= 50 THEN
      flags := flags || jsonb_build_object('type','avg6','pct',dev6_pct,'ref',round(avg6,3),'n',n6);
    END IF;
    IF z IS NOT NULL AND abs(z) >= 2 THEN
      flags := flags || jsonb_build_object('type','zscore','z',z,'mean',round(mean12,3),'sd',round(sd12,3),'n',n12);
    END IF;
    IF r.value = 0 AND coalesce(avg6, avg3, prev_val) IS NOT NULL AND coalesce(avg6, avg3, prev_val) <> 0 THEN
      flags := flags || jsonb_build_object('type','zero','ref',round(coalesce(avg6, avg3, prev_val),3));
    END IF;
    IF r.value < 0 THEN
      flags := flags || jsonb_build_object('type','negative');
    END IF;
    -- Baseline has consistently been 0 (percentages are undefined) but a
    -- non-zero value arrives now — worth a look.
    IF r.value <> 0 AND n12 >= 3 AND mean12 = 0 THEN
      flags := flags || jsonb_build_object('type','from_zero','n',n12);
    END IF;

    level := CASE
      WHEN jsonb_array_length(flags) = 0 THEN 'normal'
      WHEN (mom_pct IS NOT NULL AND abs(mom_pct) >= 100) OR (dev6_pct IS NOT NULL AND abs(dev6_pct) >= 100)
        OR (z IS NOT NULL AND abs(z) >= 3) OR r.value < 0
        OR (r.value <> 0 AND n12 >= 6 AND mean12 = 0) THEN 'high'
      ELSE 'warn' END;

    v_out := v_out || jsonb_build_object(
      'value_id', r.value_id,
      'value', r.value,
      'unit', r.unit,
      'aggregation', r.aggregation,
      'period', jsonb_build_object('year', cur_y, 'month', cur_m),
      'prev', CASE WHEN prev_val IS NULL THEN NULL ELSE jsonb_build_object('value', prev_val, 'label', prev_label, 'pct', mom_pct) END,
      'avg3', CASE WHEN avg3 IS NULL THEN NULL ELSE jsonb_build_object('value', round(avg3,3), 'n', n3, 'pct', dev3_pct) END,
      'avg6', CASE WHEN avg6 IS NULL THEN NULL ELSE jsonb_build_object('value', round(avg6,3), 'n', n6, 'pct', dev6_pct) END,
      'last_year', CASE WHEN ly_val IS NULL THEN NULL ELSE jsonb_build_object('value', ly_val, 'pct', yoy_pct) END,
      'stats', CASE WHEN n12 = 0 THEN NULL ELSE jsonb_build_object('mean', round(mean12,3), 'sd', round(coalesce(sd12,0),3), 'n', n12, 'z', z) END,
      'history', hist,
      'baseline_n', n12,
      'level', level,
      'flags', flags
    );
  END LOOP;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.get_review_context(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_review_context(text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
