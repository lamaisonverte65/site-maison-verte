-- V4.7-A + V4.7-B PRODUCTION PRE-CHECK
-- STRICTEMENT EN LECTURE SEULE.
-- Chaque instruction exécutable de ce fichier est un SELECT.
-- Aucun résultat ne doit être interprété comme une autorisation de déploiement.

-- 00 — Marqueur d'exécution.
select
  '00_v47_read_only_precheck' as result_set,
  current_database() as database_name,
  current_user as executed_by,
  now() as checked_at,
  'READ ONLY - SELECT STATEMENTS ONLY' as safety_mode;

-- 01 — Prérequis relationnels et types exacts utilisés par les migrations.
select
  expected.object_name,
  expected.object_kind,
  case
    when expected.object_kind = 'table' then to_regclass('public.' || expected.object_name)::text
    when expected.object_kind = 'function' then to_regprocedure(expected.object_name)::text
  end as existing_object
from (values
  ('booking_requests', 'table'),
  ('calendar_blocks', 'table'),
  ('external_occupancies', 'table'),
  ('public_rate_limits', 'table'),
  ('public.claim_public_rate_limit(text,text,integer,integer,timestamp with time zone)', 'function')
) as expected(object_name, object_kind)
order by expected.object_kind, expected.object_name;

select
  columns.table_name,
  columns.column_name,
  columns.data_type,
  columns.udt_name,
  columns.is_nullable,
  columns.column_default
from information_schema.columns columns
where columns.table_schema = 'public'
  and (
    (columns.table_name = 'booking_requests' and columns.column_name in ('id', 'status', 'source', 'start_date', 'end_date'))
    or (columns.table_name = 'calendar_blocks' and columns.column_name in ('id', 'start_date', 'end_date'))
    or (columns.table_name = 'external_occupancies' and columns.column_name in ('id', 'source', 'external_uid', 'start_date', 'end_date', 'is_current'))
    or (columns.table_name = 'public_rate_limits' and columns.column_name in ('scope', 'key_hash', 'window_started_at', 'attempt_count'))
  )
order by columns.table_name, columns.ordinal_position;

select
  am.amname as required_access_method,
  pg_catalog.format_type(types.oid, null) as required_range_type,
  uuid_function.oid is not null as gen_random_uuid_available
from pg_catalog.pg_am am
cross join pg_catalog.pg_type types
left join pg_catalog.pg_proc uuid_function
  on uuid_function.proname = 'gen_random_uuid'
 and pg_catalog.pg_function_is_visible(uuid_function.oid)
where am.amname = 'gist'
  and types.typname = 'daterange';

-- 02 — booking_requests : volume, statuts et sources.
select
  count(*) as booking_requests_total
from public.booking_requests;

select
  coalesce(status::text, '[NULL]') as status_value,
  count(*) as row_count
from public.booking_requests
group by status
order by status_value;

select
  coalesce(source::text, '[NULL]') as source_value,
  count(*) as row_count
from public.booking_requests
group by source
order by source_value;

-- Toute ligne retournée ici bloque V4.7-A jusqu'à classification manuelle.
select
  source::text as unclassified_source,
  count(*) as row_count
from public.booking_requests
where source is not null
  and source::text not in (
    'website', 'direct', 'admin_client', 'admin_personal',
    'booking', 'airbnb', 'booking_import', 'airbnb_import'
  )
group by source
order by unclassified_source;

-- NULL et périodes invalides. Les périodes locales bloquantes invalides bloquent la migration.
select
  count(*) filter (where id is null) as null_id_count,
  count(*) filter (where status is null) as null_status_count,
  count(*) filter (where start_date is null) as null_start_date_count,
  count(*) filter (where end_date is null) as null_end_date_count,
  count(*) filter (where start_date is not null and end_date is not null and end_date <= start_date) as invalid_period_count
from public.booking_requests;

select
  id,
  source,
  status,
  start_date,
  end_date
from public.booking_requests
where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
  and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
  and (start_date is null or end_date is null or end_date <= start_date)
order by start_date nulls first, id;

-- Paires qui violeraient exactement la future exclusion GiST V4.7-A.
select
  left_booking.id as left_booking_id,
  left_booking.source as left_source,
  left_booking.status as left_status,
  left_booking.start_date as left_start_date,
  left_booking.end_date as left_end_date,
  right_booking.id as right_booking_id,
  right_booking.source as right_source,
  right_booking.status as right_status,
  right_booking.start_date as right_start_date,
  right_booking.end_date as right_end_date
from public.booking_requests left_booking
join public.booking_requests right_booking
  on left_booking.id < right_booking.id
 and daterange(left_booking.start_date, left_booking.end_date, '[)')
     && daterange(right_booking.start_date, right_booking.end_date, '[)')
where left_booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
  and right_booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
  and (left_booking.source is null or left_booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))
  and (right_booking.source is null or right_booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))
order by left_booking.start_date, right_booking.start_date, left_booking.id, right_booking.id;

-- 03 — calendar_blocks : volume, anomalies et chevauchements pertinents.
select
  count(*) as calendar_blocks_total,
  count(*) filter (where id is null) as null_id_count,
  count(*) filter (where start_date is null) as null_start_date_count,
  count(*) filter (where end_date is null) as null_end_date_count,
  count(*) filter (where start_date is not null and end_date is not null and end_date <= start_date) as invalid_period_count
from public.calendar_blocks;

select
  id,
  start_date,
  end_date
from public.calendar_blocks
where start_date is null
   or end_date is null
   or end_date <= start_date
order by start_date nulls first, id;

select
  left_block.id as left_block_id,
  left_block.start_date as left_start_date,
  left_block.end_date as left_end_date,
  right_block.id as right_block_id,
  right_block.start_date as right_start_date,
  right_block.end_date as right_end_date
from public.calendar_blocks left_block
join public.calendar_blocks right_block
  on left_block.id < right_block.id
 and left_block.start_date < right_block.end_date
 and left_block.end_date > right_block.start_date
order by left_block.start_date, right_block.start_date, left_block.id, right_block.id;

select
  booking.id as booking_request_id,
  booking.source as booking_source,
  booking.status as booking_status,
  booking.start_date as booking_start_date,
  booking.end_date as booking_end_date,
  block.id as calendar_block_id,
  block.start_date as block_start_date,
  block.end_date as block_end_date
from public.booking_requests booking
join public.calendar_blocks block
  on booking.start_date < block.end_date
 and booking.end_date > block.start_date
where booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
  and (booking.source is null or booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))
order by booking.start_date, block.start_date, booking.id, block.id;

-- 04 — external_occupancies : volume, sources, validité, CLOSED et identité.
select
  count(*) as external_occupancies_total,
  count(*) filter (where source = 'booking') as booking_total,
  count(*) filter (where source = 'airbnb') as airbnb_total,
  count(*) filter (where source not in ('booking', 'airbnb') or source is null) as other_or_null_source_total,
  count(*) filter (where is_current is true) as current_total,
  count(*) filter (where is_current is false) as inactive_total,
  count(*) filter (where is_current is null) as null_is_current_total
from public.external_occupancies;

select
  coalesce(source::text, '[NULL]') as source_value,
  count(*) as row_count,
  count(*) filter (where is_current is true) as current_count
from public.external_occupancies
group by source
order by source_value;

select
  count(*) filter (where id is null) as null_id_count,
  count(*) filter (where external_uid is null) as null_uid_count,
  count(*) filter (where external_uid is not null and btrim(external_uid) = '') as blank_uid_count,
  count(*) filter (where start_date is null) as null_start_date_count,
  count(*) filter (where end_date is null) as null_end_date_count,
  count(*) filter (where end_date <= start_date) as invalid_period_count
from public.external_occupancies;

select
  id,
  source,
  external_uid,
  start_date,
  end_date,
  is_current
from public.external_occupancies
where source is null
   or source not in ('booking', 'airbnb')
   or external_uid is null
   or btrim(external_uid) = ''
   or start_date is null
   or end_date is null
   or end_date <= start_date
   or is_current is null
order by source nulls first, start_date nulls first, id;

-- Les événements d'une nuit sont des blocages techniques, jamais des conflits V4.7-B.
select
  source,
  count(*) as one_night_total,
  count(*) filter (where is_current is true) as current_one_night_total
from public.external_occupancies
where source in ('booking', 'airbnb')
  and end_date = start_date + 1
group by source
order by source;

select
  source,
  external_uid,
  count(*) as duplicate_count,
  array_agg(id order by id) as external_occupancy_ids
from public.external_occupancies
group by source, external_uid
having count(*) > 1
order by source, external_uid;

-- 05 — Conflits qui seraient créés immédiatement par V4.7-B.
-- PII volontairement exclues : seuls IDs, sources, statuts et périodes sont affichés.
select
  simulated.external_occupancy_id,
  simulated.external_source,
  simulated.external_uid,
  simulated.external_start_date,
  simulated.external_end_date,
  simulated.local_kind,
  simulated.local_id,
  simulated.local_source,
  simulated.local_status,
  simulated.local_start_date,
  simulated.local_end_date
from (
  select
    external.id as external_occupancy_id,
    external.source as external_source,
    external.external_uid,
    external.start_date as external_start_date,
    external.end_date as external_end_date,
    'booking_request'::text as local_kind,
    booking.id as local_id,
    coalesce(booking.source::text, '[NULL]') as local_source,
    booking.status::text as local_status,
    booking.start_date as local_start_date,
    booking.end_date as local_end_date
  from public.external_occupancies external
  join public.booking_requests booking
    on external.start_date < booking.end_date
   and external.end_date > booking.start_date
  where external.source in ('booking', 'airbnb')
    and external.is_current is true
    and external.end_date <> external.start_date + 1
    and booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
    and (booking.source is null or booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))

  union all

  select
    external.id,
    external.source,
    external.external_uid,
    external.start_date,
    external.end_date,
    'calendar_block'::text,
    block.id,
    null::text,
    null::text,
    block.start_date,
    block.end_date
  from public.external_occupancies external
  join public.calendar_blocks block
    on external.start_date < block.end_date
   and external.end_date > block.start_date
  where external.source in ('booking', 'airbnb')
    and external.is_current is true
    and external.end_date <> external.start_date + 1
    and block.start_date is not null
    and block.end_date is not null
    and block.end_date > block.start_date
) simulated
order by simulated.external_source, simulated.external_start_date, simulated.external_occupancy_id, simulated.local_kind, simulated.local_id;

select
  simulated.external_source,
  simulated.local_kind,
  count(*) as conflict_count
from (
  select external.source as external_source, 'booking_request'::text as local_kind
  from public.external_occupancies external
  join public.booking_requests booking
    on external.start_date < booking.end_date
   and external.end_date > booking.start_date
  where external.source in ('booking', 'airbnb')
    and external.is_current is true
    and external.end_date <> external.start_date + 1
    and booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
    and (booking.source is null or booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))

  union all

  select external.source, 'calendar_block'::text
  from public.external_occupancies external
  join public.calendar_blocks block
    on external.start_date < block.end_date
   and external.end_date > block.start_date
  where external.source in ('booking', 'airbnb')
    and external.is_current is true
    and external.end_date <> external.start_date + 1
    and block.start_date is not null
    and block.end_date is not null
    and block.end_date > block.start_date
) simulated
group by simulated.external_source, simulated.local_kind
order by simulated.external_source, simulated.local_kind;

-- 06 — Objets V4.7 déjà présents : toute ligne doit être expliquée avant migration.
select
  namespace.nspname as schema_name,
  class.relname as object_name,
  class.relkind as object_kind,
  pg_catalog.pg_get_userbyid(class.relowner) as owner_name
from pg_catalog.pg_class class
join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and class.relname in (
    'external_occupancy_conflicts',
    'external_occupancy_conflict_runs',
    'external_occupancy_conflicts_open_source_idx',
    'external_occupancy_conflicts_claim_idx'
  )
order by class.relname;

select
  constraint_name.conname as constraint_name,
  constraint_name.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_name.oid, true) as definition
from pg_catalog.pg_constraint constraint_name
where constraint_name.conrelid = 'public.booking_requests'::regclass
  and constraint_name.conname = 'booking_requests_no_overlapping_local_blockers';

select
  namespace.nspname as schema_name,
  procedure.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name,
  procedure.prosecdef as security_definer
from pg_catalog.pg_proc procedure
join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'create_public_booking_request_atomic',
    'reconcile_external_occupancy_conflicts',
    'claim_external_occupancy_conflict_alerts',
    'mark_external_occupancy_conflict_alert_sent',
    'release_external_occupancy_conflict_alert'
  )
order by procedure.proname, identity_arguments;

-- 07 — Résumé GO/STOP calculé uniquement pour les blocages certains de V4.7-A.
select
  (select count(*) from public.booking_requests
   where source is not null
     and source::text not in ('website', 'direct', 'admin_client', 'admin_personal', 'booking', 'airbnb', 'booking_import', 'airbnb_import')) as unclassified_source_count,
  (select count(*) from public.booking_requests
   where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
     and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
     and (start_date is null or end_date is null or end_date <= start_date)) as invalid_local_blocking_period_count,
  (select count(*)
   from public.booking_requests left_booking
   join public.booking_requests right_booking
     on left_booking.id < right_booking.id
    and daterange(left_booking.start_date, left_booking.end_date, '[)')
        && daterange(right_booking.start_date, right_booking.end_date, '[)')
   where left_booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
     and right_booking.status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
     and (left_booking.source is null or left_booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))
     and (right_booking.source is null or right_booking.source in ('website', 'direct', 'admin_client', 'admin_personal'))) as historical_local_overlap_count;

-- 08 — État historique de l'accès INSERT anon à retirer par le suivi sécurité.
-- Avant migration, anon_insert_granted/policy_exists peuvent être vrais ; après migration ils doivent être faux.
select
  has_table_privilege('anon', 'public.booking_requests', 'INSERT') as anon_insert_granted,
  has_table_privilege('anon', 'public.booking_requests', 'SELECT') as anon_select_granted,
  has_table_privilege('anon', 'public.booking_requests', 'UPDATE') as anon_update_granted,
  has_table_privilege('anon', 'public.booking_requests', 'DELETE') as anon_delete_granted;

select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'booking_requests'
order by policyname;

select
  has_function_privilege('anon', to_regprocedure('public.create_public_booking_request_atomic(jsonb,text,timestamp with time zone)'), 'EXECUTE') as anon_rpc_execute,
  has_function_privilege('authenticated', to_regprocedure('public.create_public_booking_request_atomic(jsonb,text,timestamp with time zone)'), 'EXECUTE') as authenticated_rpc_execute,
  has_function_privilege('service_role', to_regprocedure('public.create_public_booking_request_atomic(jsonb,text,timestamp with time zone)'), 'EXECUTE') as service_role_rpc_execute;
