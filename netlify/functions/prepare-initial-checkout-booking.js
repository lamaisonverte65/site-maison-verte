import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { calculatePublicBookingQuote, quoteToBookingMoney } from "./_lib/booking-quote.js";
import { hasV410FinancialSnapshot } from "./_lib/booking-financial-authority.js";
import { canMutateReservationData } from "./_lib/business-mutation-policy.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase);
  if (!auth.ok) return authorizationResponse(auth);
  auth.user = auth.authUser;
  auth.canUseAdmin = canMutateReservationData(auth);
  if (!auth.canUseAdmin) return json(403, { error: "Droit propriétaire requis." });

  try {
    const body = JSON.parse(event.body || "{}");
    const bookingId = String(body.bookingId || "").trim();
    const specialAccommodation = Number(body.specialAccommodation);
    const ownerMessage = String(body.ownerMessage || "").trim() || null;
    if (!bookingId) return json(400, { error: "bookingId manquant." });
    if (!Number.isFinite(specialAccommodation) || specialAccommodation <= 0 || specialAccommodation > 100000) {
      return json(400, { error: "Tarif spécial d’hébergement invalide." });
    }

    const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", bookingId).maybeSingle();
    if (error) throw error;
    if (!booking) return json(404, { error: "Réservation introuvable." });
    if (booking.status !== "pending") return json(409, { error: "La réservation n’est plus en attente." });

    if (!hasV410FinancialSnapshot(booking)) {
      const legacyTotal = specialAccommodation;
      const estimatedTotal = Number(booking.estimated_total || 0);
      const discountAmount = Math.max(estimatedTotal - legacyTotal, 0);
      const { data: updated, error: updateError } = await supabase.from("booking_requests").update({
        owner_price: legacyTotal,
        discount_amount: discountAmount,
        discount_reason: discountAmount > 0 ? "Tarif spécial propriétaire" : null,
        updated_at: new Date().toISOString(),
      }).eq("id", bookingId).eq("status", "pending").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return json(409, { error: "La réservation n’est plus en attente." });
      return json(200, { bookingId, legacy: true });
    }

    const taxSnapshot = booking.tourist_tax_snapshot || {};
    const preservedPromotionRate = Number(booking.promotion_discount_rate);
    const financialContext = {
      accommodationGrossCents: Math.round(specialAccommodation * 100),
      depositRate: Number(booking.deposit_rate),
      touristTaxClassification: taxSnapshot.classification || undefined,
      cleaningFeeCents: Math.round(Number(booking.cleaning_fee || 0) * 100),
      promotion: booking.promotion_code && Number.isFinite(preservedPromotionRate)
        ? { code: booking.promotion_code, discountBasisPoints: Math.round(preservedPromotionRate * 10000) }
        : null,
    };
    const quote = await calculatePublicBookingQuote(supabase, {
      startDate: booking.start_date,
      endDate: booking.end_date,
      adultsCount: Number(booking.adults_count),
      childrenCount: Number(booking.children_count || 0),
      cleaningOption: booking.cleaning_option === true,
      promotionCode: booking.promotion_code || "",
      financialContext,
    });
    const snapshot = quoteToBookingMoney(quote);
    const { data: updated, error: updateError } = await supabase.from("booking_requests").update({
      ...snapshot,
      cleaning_fee: Number(booking.cleaning_fee || 0),
      owner_price: snapshot.contract_total,
      gross_amount: snapshot.contract_total,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId).eq("status", "pending").select("id,contract_total,deposit_amount,deposit_rate").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json(409, { error: "La réservation n’est plus en attente." });
    return json(200, updated);
  } catch (error) {
    console.error("Erreur préparation Checkout initial :", error);
    return json(500, { error: "Préparation financière de la réservation impossible." });
  }
}
