import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { buildV410AcceptanceFinancials } from "./_lib/booking-acceptance-financials.js";
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
    const rawSpecialAccommodation = body.specialAccommodation;
    const hasSpecialAccommodation = rawSpecialAccommodation !== null && rawSpecialAccommodation !== undefined && String(rawSpecialAccommodation).trim() !== "";
    const specialAccommodation = hasSpecialAccommodation ? Number(rawSpecialAccommodation) : null;
    const ownerMessage = String(body.ownerMessage || "").trim() || null;
    if (!bookingId) return json(400, { error: "bookingId manquant." });
    if (hasSpecialAccommodation && (!Number.isFinite(specialAccommodation) || specialAccommodation <= 0 || specialAccommodation > 100000)) {
      return json(400, { error: "Tarif spécial d’hébergement invalide." });
    }

    const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", bookingId).maybeSingle();
    if (error) throw error;
    if (!booking) return json(404, { error: "Réservation introuvable." });
    if (booking.status !== "pending") return json(409, { error: "La réservation n’est plus en attente." });

    if (!hasV410FinancialSnapshot(booking)) {
      if (!hasSpecialAccommodation) return json(200, { bookingId, legacy: true, unchanged: true });
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

    if (!hasSpecialAccommodation) {
      return json(200, {
        id: booking.id,
        contract_total: booking.contract_total,
        deposit_amount: booking.deposit_amount,
        deposit_rate: booking.deposit_rate,
        unchanged: true,
      });
    }

    const snapshot = buildV410AcceptanceFinancials(booking, specialAccommodation);
    const { data: updated, error: updateError } = await supabase.from("booking_requests").update({
      ...snapshot,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId).eq("status", "pending").select("id,contract_total,deposit_amount,deposit_rate,accommodation_gross,accommodation_net,tourist_tax_amount").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json(409, { error: "La réservation n’est plus en attente." });
    return json(200, updated);
  } catch (error) {
    console.error("Erreur préparation Checkout initial :", error);
    return json(500, { error: "Préparation financière de la réservation impossible." });
  }
}
