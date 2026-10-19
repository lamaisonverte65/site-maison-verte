begin;

-- B1-R2 : intent de notification créé dans la même transaction que la
-- finalisation du remboursement. Aucun renvoi automatique d'un envoi incertain.
create table public.refund_notification_outbox (
  refund_operation_id uuid primary key references public.refund_operations(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'needs_review', 'not_applicable')),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index refund_notification_outbox_pending_idx
  on public.refund_notification_outbox(status, created_at, refund_operation_id)
  where status in ('pending', 'sending', 'needs_review');

alter table public.refund_notification_outbox enable row level security;
revoke all on public.refund_notification_outbox from public, anon, authenticated;
grant select, insert, update on public.refund_notification_outbox to service_role;

create function public.queue_completed_refund_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('lmv.refund_notification_outbox', true) = 'enabled'
    and old.status is distinct from 'succeeded' and new.status = 'succeeded' then
    insert into public.refund_notification_outbox(refund_operation_id)
    values (new.id) on conflict (refund_operation_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_completed_refund_notification() from public, anon, authenticated;

create trigger queue_completed_refund_notification_after_update
  after update of status on public.refund_operations
  for each row execute function public.queue_completed_refund_notification();

-- Wrapper métier R2 : lui seul active le trigger d'outbox pour SA transaction.
-- Pendant un déploiement progressif, l'ancien endpoint appelle toujours
-- finalize_stripe_refund_operation et utilise l'ancien email. Aucun intent
-- supplémentaire ne lui est créé, donc pas de double envoi croisé.
create function public.finalize_stripe_refund_operation_with_notification(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lmv.refund_notification_outbox', 'enabled', true);
  return public.finalize_stripe_refund_operation(p_operation_id);
end;
$$;
revoke all on function public.finalize_stripe_refund_operation_with_notification(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_stripe_refund_operation_with_notification(uuid)
  to service_role;

-- Réservation atomique : un seul webhook / job / appel admin peut envoyer.
-- Un état sending interrompu reste visible, mais n'est pas rejoué à l'aveugle.
create function public.claim_completed_refund_notification(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.refund_notification_outbox%rowtype;
begin
  update public.refund_notification_outbox o
  set status = 'sending', claimed_at = now(), updated_at = now()
  where o.refund_operation_id = p_operation_id
    and o.status = 'pending'
    and exists (select 1 from public.refund_operations r
                where r.id = o.refund_operation_id and r.status = 'succeeded')
  returning * into v_row;
  if found then
    return jsonb_build_object('outcome', 'claimed');
  end if;
  select * into v_row from public.refund_notification_outbox
  where refund_operation_id = p_operation_id;
  return jsonb_build_object('outcome', case when found then v_row.status else 'not_found' end);
end;
$$;

create function public.complete_refund_notification(
  p_operation_id uuid, p_status text, p_provider_id text default null, p_last_error text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.refund_notification_outbox%rowtype;
begin
  if p_status not in ('sent', 'needs_review', 'not_applicable') then
    raise exception 'invalid_refund_notification_status';
  end if;
  update public.refund_notification_outbox
  set status = p_status, provider_id = p_provider_id,
      last_error = left(p_last_error, 1000),
      sent_at = case when p_status = 'sent' then now() else null end,
      updated_at = now()
  where refund_operation_id = p_operation_id and status = 'sending'
  returning * into v_row;
  if not found then raise exception 'refund_notification_not_claimed'; end if;
  return jsonb_build_object('outcome', v_row.status);
end;
$$;

revoke all on function public.claim_completed_refund_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_completed_refund_notification(uuid) to service_role;
revoke all on function public.complete_refund_notification(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.complete_refund_notification(uuid,text,text,text) to service_role;

-- La RPC historique n'avait pas de GRANT explicite au rôle service.
-- La reprise par opération la lit via PostgREST, contrairement au moteur initial
-- qui l'appelait indirectement depuis une fonction SECURITY DEFINER.
grant execute on function public.refund_operation_snapshot(uuid) to service_role;

-- Aucun backfill sur les opérations déjà finalisées : elles peuvent avoir
-- généré une notification avant l'installation de ce mécanisme.
commit;
