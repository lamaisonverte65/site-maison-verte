// Le serveur répond volontairement de façon générique (202), que les identifiants
// correspondent ou non. Ne jamais utiliser le contenu de la réponse pour révéler
// l'existence d'une réservation. Les erreurs HTTP / réseau restent visibles.
export async function requestArrivalRecovery({ bookingId, email, lastName }, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl("/.netlify/functions/request-arrival-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, email, lastName, website: "" }),
  });
  if (!response?.ok || response.status !== 202) throw new Error("Arrival link recovery unavailable");
  return true;
}
