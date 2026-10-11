import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { buildAdditionalChargeInvoiceDraft } from "./_lib/additional-charge-invoice-draft.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (_) { return json(400, { error: "Corps JSON invalide." }); }
  const chargeId = String(body.chargeId || "").trim();
  if (!chargeId || Object.keys(body).some((key) => key !== "chargeId")) return json(400, { error: "Demande complémentaire manquante ou paramètre non autorisé." });

  const { data: charge, error: chargeError } = await supabase.from("booking_additional_charges").select("*").eq("id", chargeId).maybeSingle();
  if (chargeError) return json(500, { error: "Impossible de charger la demande complémentaire." });
  if (!charge) return json(404, { error: "Demande complémentaire introuvable." });

  const { data: existing, error: existingError } = await supabase.from("customer_invoices").select("*").eq("additional_charge_id", charge.id).maybeSingle();
  if (existingError) return json(500, { error: "Impossible de vérifier la facture complémentaire existante." });
  if (existing) return json(200, { invoice: existing, created: false });
  if (charge.status !== "paid" || !charge.payment_id) return json(409, { error: "La demande doit être payée avant création de la facture." });

  const [{ data: booking, error: bookingError }, { data: payment, error: paymentError }] = await Promise.all([
    supabase.from("booking_requests").select("*").eq("id", charge.booking_request_id).maybeSingle(),
    supabase.from("payments").select("*").eq("id", charge.payment_id).maybeSingle(),
  ]);
  if (bookingError || !booking) return json(404, { error: "Réservation introuvable." });
  if (paymentError || !payment) return json(409, { error: "Paiement complémentaire introuvable." });

  let draft;
  try { draft = buildAdditionalChargeInvoiceDraft({ booking, charge, payment }); }
  catch (error) { return json(400, { error: "Impossible de préparer la facture complémentaire.", detail: error.message }); }

  const { data: invoice, error: insertError } = await supabase.from("customer_invoices").insert([draft]).select("*").single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await supabase.from("customer_invoices").select("*").eq("additional_charge_id", charge.id).maybeSingle();
      if (raced) return json(200, { invoice: raced, created: false });
    }
    return json(500, { error: "Création du brouillon complémentaire impossible." });
  }
  await supabase.from("booking_additional_charges").update({ invoice_id: invoice.id, updated_at: new Date().toISOString() }).eq("id", charge.id);
  return json(201, { invoice, created: true });
}
