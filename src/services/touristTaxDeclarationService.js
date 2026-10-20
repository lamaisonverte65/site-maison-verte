import { supabase } from "../supabaseClient";

export async function fetchTouristTaxDeclaration(year, month) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Session admin manquante.");

  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const response = await fetch(`/.netlify/functions/admin-tourist-tax-declaration?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Impossible de charger le registre de taxe de séjour.");
  return payload;
}

async function authorizedTouristTaxRequest(url, { method = "GET", body } = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Session admin manquante.");
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Opération taxe de séjour impossible.");
  return payload;
}

const remittanceUrl = "/.netlify/functions/admin-tourist-tax-remittances";
export async function fetchTouristTaxRemittances(year, month) {
  return authorizedTouristTaxRequest(`${remittanceUrl}?${new URLSearchParams({ year: String(year), month: String(month) })}`);
}
export async function saveTouristTaxRemittance({ year, month, paymentDate, amountCents, reference, notes }) {
  return authorizedTouristTaxRequest(remittanceUrl, {
    method: "POST", body: { action: "create", year, month, paymentDate, amountCents, reference, notes },
  });
}
export async function voidTouristTaxRemittance(id) {
  return authorizedTouristTaxRequest(remittanceUrl, { method: "POST", body: { action: "void", id } });
}
