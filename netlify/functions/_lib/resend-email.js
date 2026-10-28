import { evaluateEmailDelivery } from "./email-delivery-policy.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function syntheticFailure(error) {
  const message = error instanceof Error ? error.message : String(error || "Erreur réseau inconnue");
  return {
    ok: false,
    status: 0,
    async text() {
      return `network_error: ${message}`;
    },
    async json() {
      return null;
    },
  };
}

export async function resendEmail(payload, { fetchImpl = fetch, apiKey = process.env.RESEND_API_KEY, env = process.env, idempotencyKey = null } = {}) {
  const decision = evaluateEmailDelivery(payload, env);
  if (!decision.allowed) {
    return {
      ok: false,
      status: 403,
      async text() { return decision.reason; },
      async json() { return { error: decision.reason }; },
    };
  }
  if (idempotencyKey != null && (typeof idempotencyKey !== "string" || idempotencyKey.length < 1 || idempotencyKey.length > 256)) {
    throw new Error("Clé d’idempotence Resend invalide");
  }
  try {
    return await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return syntheticFailure(error);
  }
}
