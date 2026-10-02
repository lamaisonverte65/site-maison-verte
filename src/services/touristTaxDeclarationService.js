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
