import { supabase } from "../supabaseClient";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Erreur demande de paiement complémentaire.");
  return result;
}

export function createAdditionalCharge({ bookingId, category = "other", reasonLabel, amount, customerMessage = "", cleaningIssueId = null }) {
  return post("/.netlify/functions/additional-charge", {
    action: "create", bookingId, category, reasonLabel, amount, customerMessage, cleaningIssueId,
  });
}

export function cancelAdditionalCharge(chargeId) {
  return post("/.netlify/functions/additional-charge", { action: "cancel", chargeId });
}

export function requestAdditionalChargePayment(chargeId) {
  return post("/.netlify/functions/create-additional-charge-session", { chargeId });
}

export function createAdditionalChargeInvoiceDraft(chargeId) {
  return post("/.netlify/functions/create-additional-charge-invoice-draft", { chargeId });
}
