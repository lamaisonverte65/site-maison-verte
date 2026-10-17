import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { buildTouristTaxDeclarationRows, summarizeTouristTaxDeclaration } from "./_lib/tourist-tax-declaration.js";

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  body: JSON.stringify(body),
});

function validPeriod(year, month) {
  return Number.isInteger(year) && year >= 2024 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  const year = Number(event.queryStringParameters?.year);
  const month = Number(event.queryStringParameters?.month);
  if (!validPeriod(year, month)) return json(400, { error: "Période invalide." });

  const firstNight = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  try {
    const bookingsResult = await supabase.from("booking_requests")
      .select("id,start_date,end_date,guest_first_name,guest_last_name,tourist_tax_amount,tourist_tax_collected,tourist_tax_refunded,tourist_tax_collector,tourist_tax_snapshot")
      .lt("start_date", nextMonth)
      .gt("end_date", firstNight)
      .not("tourist_tax_snapshot", "is", null)
      .in("tourist_tax_collector", ["la_maison_verte", "platform"])
      .order("start_date", { ascending: true });
    if (bookingsResult.error) throw bookingsResult.error;

    const rows = buildTouristTaxDeclarationRows({ bookings: bookingsResult.data || [] });
    const summary = summarizeTouristTaxDeclaration(rows, { year, month });
    return json(200, {
      ...summary,
      generatedAt: new Date().toISOString(),
      note: "Registre historique en lecture seule. Les montants proviennent des snapshots enregistrés avec les réservations et ne sont pas recalculés avec des règles saisies ultérieurement.",
    });
  } catch (error) {
    console.error("Erreur registre taxe de séjour :", error);
    return json(500, { error: "Impossible de calculer le registre de taxe de séjour." });
  }
}
