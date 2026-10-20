import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  body: JSON.stringify(body),
});
const PERIOD = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validDate(value) {
  const date = String(value || "");
  if (!PERIOD.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function validPeriod(year, month) {
  return Number.isInteger(year) && year >= 2026 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

export async function handler(event) {
  if (!["GET", "POST"].includes(event.httpMethod)) return json(405, { error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  try {
    if (event.httpMethod === "GET") {
      const year = Number(event.queryStringParameters?.year);
      const month = Number(event.queryStringParameters?.month);
      if (!validPeriod(year, month)) return json(400, { error: "Période invalide." });
      const { data, error } = await supabase.from("tourist_tax_remittances")
        .select("id,exercise_year,exercise_month,payment_date,amount_cents,bank_reference,notes,created_at,voided_at")
        .eq("exercise_year", year).eq("exercise_month", month)
        .order("payment_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return json(200, { entries: data || [] });
    }

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Corps JSON invalide." }); }
    if (body.action === "void") {
      if (typeof body.id !== "string" || !UUID.test(body.id)) return json(400, { error: "Référence de prélèvement invalide." });
      const { data, error } = await supabase.from("tourist_tax_remittances")
        .update({ voided_at: new Date().toISOString(), voided_by: auth.authUser.id })
        .eq("id", body.id).is("voided_at", null).select("id,voided_at").maybeSingle();
      if (error) throw error;
      if (!data) return json(409, { error: "Prélèvement déjà annulé ou inexistant." });
      return json(200, { entry: data });
    }
    if (body.action !== "create") return json(400, { error: "Action invalide." });
    const year = Number(body.year);
    const month = Number(body.month);
    const amount = Number(body.amountCents);
    const paymentDate = String(body.paymentDate || "");
    if (!validPeriod(year, month)) return json(400, { error: "Période invalide." });
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999) return json(400, { error: "Montant en centimes invalide." });
    const localToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    if (!validDate(paymentDate) || paymentDate > localToday) return json(400, { error: "Date bancaire future ou invalide." });
    const bankReference = String(body.reference || "").trim();
    const notes = String(body.notes || "").trim();
    if (bankReference.length > 200 || notes.length > 500) return json(400, { error: "Référence ou note trop longue." });
    const { data, error } = await supabase.from("tourist_tax_remittances")
      .insert({ exercise_year: year, exercise_month: month, payment_date: paymentDate,
        amount_cents: amount, bank_reference: bankReference || null, notes: notes || null, created_by: auth.authUser.id })
      .select("id,exercise_year,exercise_month,payment_date,amount_cents,bank_reference,notes,created_at,voided_at").single();
    if (error) throw error;
    return json(201, { entry: data });
  } catch (error) {
    console.error("Erreur remises taxe Aure Louron :", error);
    return json(500, { error: "Impossible de consulter ou enregistrer les prélèvements de taxe de séjour." });
  }
}
