import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { calculatePublicBookingQuote } from "./_lib/booking-quote.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, data) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(data) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const admin = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.manageReservations, ADMIN_PERMISSIONS.manageCalendar] });
  if (!admin.ok) return authorizationResponse(admin);
  try {
    const body = JSON.parse(event.body || "{}");
    const gross = body.specialAccommodation == null || body.specialAccommodation === ""
      ? null : Number(body.specialAccommodation);
    if (gross !== null && (!Number.isFinite(gross) || gross < 0)) return json(400, { error: "Tarif spécial invalide." });
    const quote = await calculatePublicBookingQuote(supabase, {
      startDate: body.startDate, endDate: body.endDate,
      adultsCount: Number(body.adultsCount), childrenCount: Number(body.childrenCount || 0),
      cleaningOption: body.cleaningOption !== false,
      promotionCode: body.promotionCode || "",
      financialContext: gross === null ? {} : { accommodationGrossCents: Math.round(gross * 100) },
    });
    return json(200, {
      nights: quote.nights.length,
      accommodation: quote.accommodationGrossCents / 100,
      discount: quote.promotion?.discountCents ? quote.promotion.discountCents / 100 : 0,
      cleaning: quote.cleaningAppliedCents / 100,
      touristTax: quote.touristTaxCents / 100,
      total: quote.contractTotalCents / 100,
      quoteSource: gross === null ? "automatic" : "manual",
    });
  } catch (error) {
    return json(400, { error: error.message || "Devis indisponible." });
  }
}
