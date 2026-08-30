create table if not exists public.public_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  primary key (scope, key_hash)
);

create index if not exists public_rate_limits_window_started_at_idx
  on public.public_rate_limits (window_started_at);

alter table public.public_rate_limits enable row level security;

create or replace function public.claim_public_rate_limit(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if p_scope is null or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_window_seconds < 1 or p_limit < 1 then
    return false;
  end if;

  -- Keep anonymous throttling state bounded without requiring a separate scheduler.
  delete from public.public_rate_limits
  where window_started_at < p_now - interval '2 days';

  insert into public.public_rate_limits as limits (
    scope, key_hash, window_started_at, attempt_count
  ) values (
    p_scope, p_key_hash, p_now, 1
  )
  on conflict (scope, key_hash) do update set
    window_started_at = case
      when limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then p_now
      else limits.window_started_at
    end,
    attempt_count = case
      when limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then 1
      else limits.attempt_count + 1
    end
  returning attempt_count into next_count;

  return next_count <= p_limit;
end;
$$;

revoke all on table public.public_rate_limits from anon, authenticated;
revoke all on function public.claim_public_rate_limit(text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_public_rate_limit(text, text, integer, integer, timestamptz) to service_role;
