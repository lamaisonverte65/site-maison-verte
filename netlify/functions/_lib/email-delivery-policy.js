// V4.15 R13.3e — Sécurité des courriels pendant la recette.
// Ne jamais substituer une adresse de client : seuls des destinataires de test
// explicitement autorisés peuvent sortir via Resend en mode allowlist.
//
// En production réelle (domaine canonique + contexte Netlify production), la
// configuration existante reste active si aucun mode n'a été défini.
// Partout ailleurs, absence de configuration = blocage (fail closed).

const LIVE_HOSTS = new Set(["lamaisonverte65.fr", "www.lamaisonverte65.fr"]);
const SIMPLE_EMAIL = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;

export function isKnownLiveDeployment(env = process.env) {
  if (env.CONTEXT !== "production") return false;
  try {
    const url = new URL(String(env.URL || ""));
    return url.protocol === "https:" && LIVE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function emailDeliveryMode(env = process.env) {
  const explicit = String(env.LMV_EMAIL_DELIVERY_MODE || "").trim().toLowerCase();
  if (explicit === "block") return "block";
  if (explicit === "allowlist") return "allowlist";
  // Ne jamais activer implicitement des envois sur une URL Netlify de TEST.
  if (explicit && explicit !== "live") return "block";
  return isKnownLiveDeployment(env) ? "live" : "block";
}

function recipientsIn(value) {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  const result = [];
  for (const entry of list) {
    if (typeof entry !== "string") return null;
    const trimmed = entry.trim();
    // Refuser les chaînes séparées par virgules (pas d'analyse ambiguë).
    const named = trimmed.match(/^([^<>]+)<([^<>]+)>$/);
    const address = named ? named[2].trim() : trimmed;
    if (!SIMPLE_EMAIL.test(address)) return null;
    result.push(address.toLowerCase());
  }
  return result;
}

function parseAllowlist(value) {
  const values = String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!values.length) return null;
  const emails = recipientsIn(values);
  return emails && emails.length === values.length ? new Set(emails) : null;
}

export function evaluateEmailDelivery(payload, env = process.env) {
  const mode = emailDeliveryMode(env);
  if (mode === "block") return { allowed: false, reason: "email_guard_blocked", mode };
  if (mode === "live") return { allowed: true, mode };

  const allowlist = parseAllowlist(env.LMV_EMAIL_ALLOWED_RECIPIENTS);
  if (!allowlist) return { allowed: false, reason: "email_guard_missing_allowlist", mode };

  const to = recipientsIn(payload?.to);
  const cc = recipientsIn(payload?.cc);
  const bcc = recipientsIn(payload?.bcc);
  if (!to?.length || cc === null || bcc === null) {
    return { allowed: false, reason: "email_guard_invalid_recipients", mode };
  }

  // Pas de deuxième canal de destinataires cachés dans des entêtes libres.
  const headers = payload?.headers;
  if (headers && (
    typeof headers !== "object" ||
    Object.keys(headers).some((key) => /^(?:to|cc|bcc|resent-to|resent-cc|resent-bcc)$/i.test(key))
  )) {
    return { allowed: false, reason: "email_guard_ambiguous_headers", mode };
  }

  const all = [...to, ...cc, ...bcc];
  if (!all.every((address) => allowlist.has(address))) {
    return { allowed: false, reason: "email_guard_recipient_not_allowed", mode };
  }
  return { allowed: true, mode };
}

// Toute tâche planifiée est neutralisée en mode recette : même avec une
// allowlist, elle pourrait modifier des réservations ou états de relance.
export function emailAutomationAllowed(env = process.env) {
  return emailDeliveryMode(env) === "live";
}

export function emailAutomationSkippedResponse() {
  return {
    statusCode: 200,
    body: JSON.stringify({ skipped: true, reason: "email_test_automation_disabled" }),
  };
}
