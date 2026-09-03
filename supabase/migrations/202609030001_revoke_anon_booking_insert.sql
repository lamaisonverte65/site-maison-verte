-- AUTH-02: public creation now uses send-booking-request and the service-role RPC.
-- Remove only the obsolete anonymous insertion path. No business data changes.
-- Re-runnable: REVOKE tolerates an absent grant; DROP POLICY tolerates absence.
revoke insert on table public.booking_requests from anon;
drop policy if exists "Allow public insert booking requests" on public.booking_requests;
