export function generateHousekeepingPassword(cryptoProvider = globalThis.crypto) {
  if (typeof cryptoProvider?.getRandomValues !== "function") {
    throw new Error("Génération sécurisée indisponible. Utilisez un navigateur récent en HTTPS.");
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!-";
  let password;
  do {
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
    // 64 symbols divide 256 exactly: no modulo bias, no predictable suffix.
    password = Array.from(bytes, (byte) => alphabet[byte % 64]).join("");
  } while (![ /[a-z]/, /[A-Z]/, /[0-9]/, /[!-]/ ].every((pattern) => pattern.test(password)));
  return password;
}

export function buildHousekeepingCreationPayload(form = {}) {
  return {
    email: String(form.email || "").trim().toLowerCase(),
    display_name: String(form.display_name || "").trim(),
    temporaryPassword: String(form.temporaryPassword || ""),
  };
}

export function buildHousekeepingUpdatePayload(changes = {}) {
  const payload = {};
  if (Object.hasOwn(changes, "display_name")) {
    const displayName = String(changes.display_name || "").trim();
    if (displayName) payload.display_name = displayName;
  }
  if (typeof changes.is_active === "boolean") payload.is_active = changes.is_active;
  return payload;
}
