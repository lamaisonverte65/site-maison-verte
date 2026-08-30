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
