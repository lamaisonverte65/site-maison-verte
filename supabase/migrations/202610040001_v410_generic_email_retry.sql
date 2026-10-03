begin;

alter table public.email_logs
  add column if not exists retry_payload jsonb,
  add column if not exists retry_attempts integer not null default 0,
  add column if not exists retry_next_at timestamptz,
  add column if not exists retry_last_at timestamptz,
  add column if not exists retry_exhausted_at timestamptz;

alter table public.email_logs
  drop constraint if exists email_logs_retry_attempts_nonnegative;

alter table public.email_logs
  add constraint email_logs_retry_attempts_nonnegative
  check (retry_attempts >= 0);

create index if not exists email_logs_retry_pending_idx
  on public.email_logs (status, retry_next_at, created_at)
  where status = 'error'
    and retry_payload is not null
    and retry_exhausted_at is null;

comment on column public.email_logs.retry_payload is
  'Snapshot exact du payload Resend à rejouer sans réexécuter l''action métier.';
comment on column public.email_logs.retry_attempts is
  'Nombre de tentatives automatiques de renvoi effectuées après l''échec initial.';
comment on column public.email_logs.retry_next_at is
  'Date minimale de la prochaine tentative automatique.';
comment on column public.email_logs.retry_last_at is
  'Date de la dernière tentative automatique.';
comment on column public.email_logs.retry_exhausted_at is
  'Renseigné quand le retry automatique est abandonné ou devenu inutile.';

commit;
