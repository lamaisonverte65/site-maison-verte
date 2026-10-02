import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { buildDirectInvoiceDraft, buildLegacyDirectInvoiceDraft, buildReconstructedLegacyDirectInvoiceDraft } from "./_lib/direct-invoice-draft.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (_) { return json(400, { error: "Corps JSON invalide." }); }
  const bookingId = String(body.bookingRequestId || "").trim();
  if (!bookingId) return json(400, { error: "Réservation manquante." });

  const { data: existing, error: existingError } = await supabase
    .from("customer_invoices")
    .select("*")
    .eq("source", "direct")
    .eq("booking_request_id", bookingId)
    .maybeSingle();
  if (existingError) return json(500, { error: "Impossible de vérifier les factures existantes." });
  if (existing?.status === "issued") return json(200, { invoice: existing, created: false, reconstructed: false });

  const [{ data: booking, error: bookingError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("booking_requests").select("*").eq("id", bookingId).maybeSingle(),
    supabase.from("payments").select("*").eq("booking_request_id", bookingId).order("created_at", { ascending: true }),
  ]);
  if (bookingError || !booking) return json(404, { error: "Réservation introuvable." });
  if (paymentsError) return json(500, { error: "Impossible de charger les paiements." });

  let draft;
  try { draft = buildDirectInvoiceDraft({ booking, payments: payments || [] }); }
  catch (error) {
    const message = String(error?.message || "");
    if (message === "direct_booking_required") return json(409, { error: "Cette réservation n'est pas une réservation Direct." });
    if (message.startsWith("v410_snapshot_incomplete:")) {
      let reconstructed = null;
      const [{ data: seasons, error: seasonsError }, { data: overrides, error: overridesError }] = await Promise.all([
        supabase.from("season_prices").select("start_date,end_date,night_price,is_active,created_at,updated_at").lt("start_date", booking.end_date).gt("end_date", booking.start_date).order("start_date", { ascending: true }),
        supabase.from("price_overrides").select("start_date,end_date,night_price,is_active,created_at,updated_at").lt("start_date", booking.end_date).gt("end_date", booking.start_date).order("start_date", { ascending: true }),
      ]);
      if (!seasonsError && !overridesError) {
        reconstructed = buildReconstructedLegacyDirectInvoiceDraft({ booking, payments: payments || [], seasons: seasons || [], overrides: overrides || [] });
      }
      if (reconstructed) draft = reconstructed;
      else {
        try { draft = buildLegacyDirectInvoiceDraft({ booking, payments: payments || [] }); }
        catch (legacyError) {
          const legacyMessage = String(legacyError?.message || "");
          if (legacyMessage === "legacy_total_missing") return json(409, { error: "Montant historique de la réservation introuvable : brouillon impossible sans justificatif." });
          return json(400, { error: "Impossible de préparer le brouillon historique.", detail: legacyMessage });
        }
      }
    } else return json(400, { error: "Impossible de préparer le brouillon de facture.", detail: message });
  }

  const reconstructed = draft.financial_snapshot?.reconstruction?.method === "historical_tariff_match";

  if (existing) {
    const existingIsManualLegacy = existing.financial_snapshot?.draft_origin === "legacy_direct_manual";
    const existingNotReady = existing.financial_snapshot?.invoice_ready !== true;
    if (reconstructed && existingIsManualLegacy && existingNotReady) {
      const { data: upgraded, error: updateError } = await supabase
        .from("customer_invoices")
        .update({
          seller_snapshot: draft.seller_snapshot,
          customer_snapshot: draft.customer_snapshot,
          stay_snapshot: draft.stay_snapshot,
          financial_snapshot: draft.financial_snapshot,
          payment_snapshot: draft.payment_snapshot,
          total_amount: draft.total_amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("status", "draft")
        .select("*")
        .single();
      if (updateError) return json(500, { error: "Reconstruction du brouillon historique impossible." });
      return json(200, { invoice: upgraded, created: false, reconstructed: true });
    }
    return json(200, { invoice: existing, created: false, reconstructed: false });
  }

  const { data: invoice, error: insertError } = await supabase
    .from("customer_invoices")
    .insert([draft])
    .select("*")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await supabase.from("customer_invoices").select("*").eq("source", "direct").eq("booking_request_id", bookingId).maybeSingle();
      if (raced) return json(200, { invoice: raced, created: false, reconstructed: false });
    }
    return json(500, { error: "Création du brouillon impossible." });
  }
  return json(201, { invoice, created: true, reconstructed });
}
