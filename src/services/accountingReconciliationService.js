import { supabase } from "../supabaseClient";

export async function fetchAccountingReconciliation(year) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Session admin manquante.");

  const params = new URLSearchParams({ year: String(year) });
  const response = await fetch(`/.netlify/functions/admin-accounting-reconciliation?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Impossible de charger le rapprochement comptable.");
  if (Number(payload?.year) !== Number(year) || !Array.isArray(payload?.rows)
    || !payload?.accountingSummary || typeof payload.accountingSummary !== "object"
    || !payload?.taxSummary || typeof payload.taxSummary !== "object") {
    throw new Error("Réponse du rapprochement comptable incohérente.");
  }
  return payload;
}
