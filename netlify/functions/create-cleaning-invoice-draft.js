import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { buildCleaningInvoiceDraft } from "./_lib/cleaning-invoice-draft.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (_) { return json(400, { error: "Corps JSON invalide." }); }
  const bookingId = String(body.bookingRequestId || "").trim();
  if (!bookingId || Object.keys(body).some((key) => key !== "bookingRequestId")) return json(400, { error: "Réservation manquante ou paramètre non autorisé." });

  const { data: issue, error: issueError } = await supabase.from("booking_cleaning_issues").select("*").eq("booking_request_id", bookingId).maybeSingle();
  if (issueError) return json(500, { error: "Impossible de charger le dossier ménage." });
  if (!issue) return json(404, { error: "Dossier ménage introuvable." });

  const { data: existing, error: existingError } = await supabase.from("customer_invoices").select("*").eq("cleaning_issue_id", issue.id).maybeSingle();
  if (existingError) return json(500, { error: "Impossible de vérifier la facture ménage existante." });
  if (existing) return json(200, { invoice: existing, created: false });
  if (issue.status !== "paid" || !issue.payment_id) return json(409, { error: "Le ménage doit être payé avant création de la facture." });

  const [{ data: booking, error: bookingError }, { data: payment, error: paymentError }] = await Promise.all([
    supabase.from("booking_requests").select("*").eq("id", bookingId).maybeSingle(),
    supabase.from("payments").select("*").eq("id", issue.payment_id).maybeSingle(),
  ]);
  if (bookingError || !booking) return json(404, { error: "Réservation introuvable." });
  if (paymentError || !payment) return json(409, { error: "Paiement ménage introuvable." });

  let draft;
  try { draft = buildCleaningInvoiceDraft({ booking, issue, payment }); }
  catch (error) { return json(400, { error: "Impossible de préparer la facture ménage.", detail: error.message }); }

  const { data: invoice, error: insertError } = await supabase.from("customer_invoices").insert([draft]).select("*").single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await supabase.from("customer_invoices").select("*").eq("cleaning_issue_id", issue.id).maybeSingle();
      if (raced) return json(200, { invoice: raced, created: false });
    }
    return json(500, { error: "Création du brouillon ménage impossible." });
  }

  await supabase.from("booking_cleaning_issues").update({ invoice_id: invoice.id, updated_at: new Date().toISOString() }).eq("id", issue.id);
  return json(201, { invoice, created: true });
}
