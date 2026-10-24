import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { validateBookingLanguageChange } from "./_lib/booking-language-policy.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(payload),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée." });

  // Vérifier l'identité AVANT de lire ou de modifier des données métier.
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON invalide." });
  }
  const change = validateBookingLanguageChange(body);
  if (!change.ok) return json(400, { error: change.error });

  try {
    const { data, error } = await supabase
      .from("booking_requests")
      .update({ communication_language: change.communicationLanguage })
      .eq("id", change.bookingId)
      .select("id,communication_language")
      .maybeSingle();
    if (error) throw error;
    if (!data) return json(404, { error: "Réservation introuvable." });
    return json(200, {
      ok: true,
      bookingId: data.id,
      communicationLanguage: data.communication_language,
    });
  } catch (error) {
    console.error("update-booking-language:", error?.message || "Erreur inconnue");
    return json(500, { error: "Impossible d'enregistrer la langue. Vérifier l'application de la migration V4.15." });
  }
}
