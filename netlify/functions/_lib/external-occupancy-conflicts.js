import { escapeHtml } from "./html.js";

const VALID_SOURCES = new Set(["booking", "airbnb"]);

export async function reconcileSuccessfulExternalSources(repository, sources, detectedAt) {
  const uniqueSources = [];
  const seen = new Set();
  for (const value of sources || []) {
    const source = String(value || "").trim().toLowerCase();
    if (!VALID_SOURCES.has(source) || seen.has(source)) continue;
    seen.add(source);
    uniqueSources.push(source);
  }

  const results = [];
  for (const source of uniqueSources) {
    results.push(await repository.reconcileSource(source, detectedAt));
  }
  return results;
}

function sourceLabel(source) {
  return String(source || "").toLowerCase() === "airbnb" ? "Airbnb" : "Booking";
}

function localKindLabel(kind) {
  return kind === "calendar_block" ? "blocage administrateur" : "réservation directe";
}

export function buildExternalConflictAlertEmail(conflict, ownerEmail) {
  const to = String(ownerEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Destinataire d'alerte de conflit invalide.");
  }

  const source = sourceLabel(conflict?.source);
  const externalStart = escapeHtml(String(conflict?.external_start_date || "?"));
  const externalEnd = escapeHtml(String(conflict?.external_end_date || "?"));
  const localKind = localKindLabel(conflict?.local_kind);
  const localStart = escapeHtml(String(conflict?.local_start_date || "?"));
  const localEnd = escapeHtml(String(conflict?.local_end_date || "?"));

  return {
    to,
    subject: "Alerte — chevauchement de réservation détecté",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Alerte calendrier — La Maison Verte</h2>
      <p>Un chevauchement a été détecté avec une occupation ${source}.</p>
      <ul>
        <li><strong>Source externe :</strong> ${source}</li>
        <li><strong>Période externe :</strong> ${externalStart} → ${externalEnd}</li>
        <li><strong>Occupation locale :</strong> ${localKind}</li>
        <li><strong>Période locale :</strong> ${localStart} → ${localEnd}</li>
      </ul>
      <p><strong>Une intervention humaine est nécessaire.</strong></p>
      <p>Selon la situation, une annulation ou un remboursement pourra être nécessaire. Aucune action automatique n’a été effectuée.</p>
    </div>`,
  };
}

export async function processExternalConflictAlerts({ repository, sendEmail, ownerEmail, now }) {
  const claimed = await repository.claimAlerts(now);
  let sent = 0;
  let failed = 0;

  for (const conflict of claimed || []) {
    const occurrence = Number(conflict?.occurrence_count);
    try {
      const email = buildExternalConflictAlertEmail(conflict, ownerEmail);
      await sendEmail(email, conflict);
      await repository.markSent(conflict.id, occurrence, now);
      sent += 1;
    } catch (error) {
      failed += 1;
      await repository.release(conflict.id, occurrence, now);
    }
  }

  if (failed) throw new Error(`${failed} conflict alert delivery failure(s).`);
  return { claimed: (claimed || []).length, sent, failed };
}
