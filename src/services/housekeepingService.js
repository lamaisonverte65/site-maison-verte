const ENDPOINT = "/.netlify/functions/housekeeping";
const NOTES_ENDPOINT = "/.netlify/functions/housekeeping-notes";

async function callHousekeeping(endpoint, payload, { accessToken, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "Erreur données ménage.");
  return data;
}

export async function fetchHousekeepingData(options = {}) {
  const data = await callHousekeeping(ENDPOINT, { action: "list" }, options);
  return { reservations: data.reservations || [] };
}

export async function createHousekeepingNote({ accessToken, fetchImpl, reservationId, note }) {
  const data = await callHousekeeping(
    NOTES_ENDPOINT,
    { action: "create", reservationId, note },
    { accessToken, fetchImpl },
  );
  return data.note;
}

export async function fetchHousekeepingNotes({ accessToken, fetchImpl, reservationId }) {
  const data = await callHousekeeping(
    NOTES_ENDPOINT,
    { action: "list", reservationId },
    { accessToken, fetchImpl },
  );
  return data.notes || [];
}

export async function fetchAdminDataForRole(role, { loadHousekeeping, loadOwner }) {
  return role === "housekeeping" ? loadHousekeeping() : loadOwner();
}
