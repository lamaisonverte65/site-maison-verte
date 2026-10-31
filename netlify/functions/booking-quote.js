import { createClient } from "@supabase/supabase-js";
import { calculatePublicBookingQuote } from "./_lib/booking-quote.js";
import { centsToEuros } from "./_lib/tourist-tax.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  try {
    const input = JSON.parse(event.body || "{}");
    const allowed = new Set(["startDate", "endDate", "adultsCount", "childrenCount", "cleaningOption", "promotionCode"]);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) {
      return json(400, { error: "Paramètres du devis invalides." });
    }
    // Ne jamais laisser un appel public utiliser financialContext : il est
    // réservé aux recalculs de réservation effectués côté serveur.
    // Vérifier la borne AVANT de générer les nuits (protection contre un
    // intervalle de plusieurs années soumis par un robot).
    const from = Date.parse(`${input.startDate}T12:00:00Z`);
    const to = Date.parse(`${input.endDate}T12:00:00Z`);
    const durationMs = to - from;
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60 * 86400000) {
      return json(400, { error: "Durée maximale : 60 nuits." });
    }
    const quote = await calculatePublicBookingQuote(supabase, input);
    return json(200, {
      accommodationGross: centsToEuros(quote.accommodationGrossCents),
      promotionCode: quote.promotion?.code || null,
      promotionDiscount: quote.promotion ? centsToEuros(quote.promotion.discountCents) : 0,
      accommodationNet: centsToEuros(quote.accommodationNetCents),
      cleaningFee: centsToEuros(quote.cleaningFeeCents),
      cleaningApplied: centsToEuros(quote.cleaningAppliedCents),
      touristTax: centsToEuros(quote.touristTaxCents),
      depositRate: quote.depositRate,
      depositAmount: centsToEuros(quote.depositCents),
      total: centsToEuros(quote.totalCents),
    });
  } catch (error) {
    console.error("Erreur devis réservation :", error);
    return json(400, { error: "Calcul du séjour indisponible pour ces informations." });
  }
}
