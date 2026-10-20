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
      .select("id,status,start_date,end_date,guest_first_name,guest_last_name,tourist_tax_amount,tourist_tax_collected,tourist_tax_refunded,tourist_tax_collector,tourist_tax_snapshot")
      .lt("start_date", nextMonth)
      .gt("end_date", firstNight)
      .not("tourist_tax_snapshot", "is", null)
      .in("tourist_tax_collector", ["la_maison_verte", "platform"])
      .order("start_date", { ascending: true });
    if (bookingsResult.error) throw bookingsResult.error;

    // Regulatory lookup is for the declaration ONLY; the commercial snapshot
    // remains the authority for the contractual amount and is never altered.
    const [historyResult, rulesResult] = await Promise.all([
      supabase.from("tourist_tax_classification_history")
        .select("classification,effective_from,effective_to")
        .lte("effective_from", nextMonth).order("effective_from", { ascending: true }),
      supabase.from("tourist_tax_rules")
        .select("id,classification,effective_from,effective_to,calculation_type,base_rate_basis_points,department_additional_basis_points,regional_additional_basis_points,base_cap_cents,fixed_rate_cents,is_active")
        .eq("is_active", true).lte("effective_from", nextMonth),
    ]);
    if (historyResult.error) throw historyResult.error;
    if (rulesResult.error) throw rulesResult.error;
    // Local civil date in Aure-Louron. A booked future night is not yet due.
    const todayDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const rows = buildTouristTaxDeclarationRows({
      bookings: bookingsResult.data || [],
      classificationHistory: historyResult.data || [],
      rules: rulesResult.data || [],
      todayDate,
    });
    const summary = summarizeTouristTaxDeclaration(rows, { year, month });
    return json(200, {
      ...summary,
      generatedAt: new Date().toISOString(),
      note: "Les montants contractuels restent issus des snapshots. La taxe indicative Aure Louron est recalculée séparément selon le classement et le barème à chaque nuit. Confirmer les nuitées réellement effectuées avant déclaration.",
    });
  } catch (error) {
    console.error("Erreur registre taxe de séjour :", error);
    return json(500, { error: "Impossible de calculer le registre de taxe de séjour." });
  }
}
