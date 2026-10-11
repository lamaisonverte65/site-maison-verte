import { supabase } from "../supabaseClient";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function readJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}

export async function updateCleaningIssue(bookingId, action, note = undefined) {
  const body = { action, bookingId };
  if (note !== undefined) body.note = note;
  const response = await fetch("/.netlify/functions/cleaning-issue", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return readJson(response, "Erreur dossier ménage.");
}

export async function requestCleaningPayment(bookingId) {
  const response = await fetch("/.netlify/functions/create-cleaning-payment-session", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ bookingId }),
  });
  return readJson(response, "Impossible de créer le lien de paiement ménage.");
}
