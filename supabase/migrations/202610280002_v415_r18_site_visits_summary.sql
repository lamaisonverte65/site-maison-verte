-- La Maison Verte V4.15 R18
-- Statistiques compactes des seules pages vues, accessibles au propriétaire.
-- Aucun UPDATE/DELETE/TRUNCATE de site_visits.
BEGIN;

CREATE FUNCTION public.get_admin_visit_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_today date := (pg_catalog.now() AT TIME ZONE 'Europe/Paris')::date;
  v_start_day date;
  v_result jsonb;
BEGIN
  IF NOT coalesce(public.is_v4_owner(), false) THEN
    RAISE EXCEPTION 'owner_required';
  END IF;
  IF p_days IS NULL OR p_days < 30 OR p_days > 90 THEN
    RAISE EXCEPTION 'invalid_analytics_period';
  END IF;
  v_start_day := v_today - (p_days - 1);

  -- Au plus une ligne de page vue par événement. Ignorer les anciens
  -- heartbeats/scroll/clics et les entrées explicitement internes.
  WITH views AS MATERIALIZED (
    SELECT
      (v.created_at AT TIME ZONE 'Europe/Paris')::date AS view_day,
      coalesce(nullif(v.page, ''), '/') AS page,
      coalesce(nullif(v.source, ''), 'direct') AS source,
      coalesce(nullif(v.language, ''), 'Non renseignée') AS language,
      coalesce(nullif(v.device_type, ''), 'Non renseigné') AS device
    FROM public.site_visits AS v
    WHERE v.created_at >= (v_start_day::timestamp AT TIME ZONE 'Europe/Paris')
      AND coalesce(v.event_type, v.metadata->>'event_type', 'page_view') = 'page_view'
      AND NOT coalesce(v.is_internal, false)
      AND coalesce(v.metadata->>'is_internal', 'false') <> 'true'
  )
  SELECT pg_catalog.jsonb_build_object(
    'period_days', p_days,
    'today', (SELECT count(*) FROM views WHERE view_day = v_today),
    'last7', (SELECT count(*) FROM views WHERE view_day >= v_today - 6),
    'last30', (SELECT count(*) FROM views WHERE view_day >= v_today - 29),
    'daily', (
      SELECT coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('date', d.day::text, 'pages', d.total)
          ORDER BY d.day
        ), '[]'::jsonb
      )
      FROM (
        SELECT dates.day, count(v.view_day) AS total
        FROM (
          SELECT (v_start_day + days.idx) AS day
          FROM pg_catalog.generate_series(0, p_days - 1) AS days(idx)
        ) AS dates
        LEFT JOIN views AS v ON v.view_day = dates.day
        GROUP BY dates.day
      ) AS d
    ),
    'sources', (
      SELECT coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('label', groups.source, 'count', groups.total)
        ORDER BY groups.total DESC, groups.source
      ), '[]'::jsonb)
      FROM (
        SELECT source, count(*) AS total FROM views
        WHERE view_day >= v_today - 29
        GROUP BY source ORDER BY total DESC, source LIMIT 8
      ) AS groups
    ),
    'pages', (
      SELECT coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('label', groups.page, 'count', groups.total)
        ORDER BY groups.total DESC, groups.page
      ), '[]'::jsonb)
      FROM (
        SELECT page, count(*) AS total FROM views
        WHERE view_day >= v_today - 29
        GROUP BY page ORDER BY total DESC, page LIMIT 10
      ) AS groups
    ),
    'languages', (
      SELECT coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('label', groups.language, 'count', groups.total)
        ORDER BY groups.total DESC, groups.language
      ), '[]'::jsonb)
      FROM (
        SELECT language, count(*) AS total FROM views
        WHERE view_day >= v_today - 29
        GROUP BY language ORDER BY total DESC, language LIMIT 8
      ) AS groups
    ),
    'devices', (
      SELECT coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('label', groups.device, 'count', groups.total)
        ORDER BY groups.total DESC, groups.device
      ), '[]'::jsonb)
      FROM (
        SELECT device, count(*) AS total FROM views
        WHERE view_day >= v_today - 29
        GROUP BY device ORDER BY total DESC, device LIMIT 6
      ) AS groups
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_visit_summary(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_visit_summary(integer) TO authenticated;
COMMIT;
