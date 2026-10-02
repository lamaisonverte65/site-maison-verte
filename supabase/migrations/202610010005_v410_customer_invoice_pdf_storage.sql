-- La Maison Verte V4.10 — B3 stockage privé des factures PDF
-- Le bucket est privé. Les accès applicatifs passent par les fonctions owner-only utilisant service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-invoices', 'customer-invoices', false, 5242880, array['application/pdf']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf']::text[];
