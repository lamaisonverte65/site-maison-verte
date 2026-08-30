alter table public.booking_requests
  add column if not exists arrival_token_hash text,
  add column if not exists arrival_token_expires_at timestamptz,
  add column if not exists arrival_token_created_at timestamptz;

comment on column public.booking_requests.arrival_token_hash is
  'SHA-256 hash of the single-booking capability token used only to submit arrival_time.';

create index if not exists booking_requests_arrival_token_expiry_idx
  on public.booking_requests (arrival_token_expires_at)
  where arrival_token_hash is not null;
