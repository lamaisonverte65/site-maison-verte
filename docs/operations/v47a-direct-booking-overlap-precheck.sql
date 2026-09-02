-- V4.7-A production pre-check. Read-only statements only.
-- Run every result set and review non-empty anomaly sets before the migration.

select
  coalesce(source::text, '[NULL]') as source_value,
  count(*) as row_count
from public.booking_requests
group by source
order by source_value;

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
order by start_date, id;

with local_blocking as (
  select id, source, status, start_date, end_date
  from public.booking_requests
  where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
    and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
)
select
  left_booking.id as left_booking_id,
  right_booking.id as right_booking_id,
  left_booking.start_date as left_start_date,
  left_booking.end_date as left_end_date,
  right_booking.start_date as right_start_date,
  right_booking.end_date as right_end_date
from local_blocking left_booking
join local_blocking right_booking
  on left_booking.id < right_booking.id
 and daterange(left_booking.start_date, left_booking.end_date, '[)')
     && daterange(right_booking.start_date, right_booking.end_date, '[)')
order by left_booking.start_date, right_booking.start_date;

with local_blocking as (
  select id, start_date, end_date
  from public.booking_requests
  where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
    and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
)
select
  booking.id as booking_request_id,
  block.id as calendar_block_id,
  booking.start_date as booking_start_date,
  booking.end_date as booking_end_date,
  block.start_date as block_start_date,
  block.end_date as block_end_date
from local_blocking booking
join public.calendar_blocks block
  on daterange(booking.start_date, booking.end_date, '[)')
     && daterange(block.start_date, block.end_date, '[)')
order by booking.start_date, block.start_date;

with local_blocking as (
  select id, start_date, end_date
  from public.booking_requests
  where status in ('pending', 'accepted', 'deposit_paid', 'paid', 'fully_paid', 'confirmed')
    and (source is null or source in ('website', 'direct', 'admin_client', 'admin_personal'))
)
select
  booking.id as booking_request_id,
  external.id as external_occupancy_id,
  external.source as external_source,
  booking.start_date as booking_start_date,
  booking.end_date as booking_end_date,
  external.start_date as external_start_date,
  external.end_date as external_end_date
from local_blocking booking
join public.external_occupancies external
  on external.is_current is true
 and not (external.source = 'booking' and external.end_date = external.start_date + 1)
 and daterange(booking.start_date, booking.end_date, '[)')
     && daterange(external.start_date, external.end_date, '[)')
order by booking.start_date, external.start_date;
