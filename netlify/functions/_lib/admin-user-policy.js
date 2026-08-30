import { isOwnerProfile } from "../../../shared/adminPermissions.js";

const deny = (error, statusCode = 403) => ({ ok: false, statusCode, error });
const createFields = new Set(["email", "display_name", "temporaryPassword"]);
const updateFields = new Set(["display_name", "is_active"]);
const activeActions = new Set([
  "me",
  "list",
  "create_housekeeping",
  "update_housekeeping",
  "reset_housekeeping_password",
  "delete_housekeeping",
]);

export const isActiveAdminUsersAction = (action) => activeActions.has(String(action || ""));

function rejectUnknownFields(input, allowed) {
  const unknown = Object.keys(input || {}).find((field) => !allowed.has(field));
  return unknown ? deny(`Attribut non autorisé : ${unknown}.`, 400) : null;
}

export function canAdministerHousekeeping(requester, target) {
  if (!isOwnerProfile(requester)) return deny("Droit propriétaire requis.");
  if (!target) return deny("Compte ménage introuvable.", 404);
  if (target.role !== "housekeeping" || target.is_owner === true) {
    return deny("Seul un compte ménage peut être administré par cette opération.");
  }
  return { ok: true };
}

export function validateCreateHousekeeping(requester, input = {}) {
  if (!isOwnerProfile(requester)) return deny("Droit propriétaire requis.");
  const unknown = rejectUnknownFields(input, createFields);
  if (unknown) return unknown;

  const email = String(input.email || "").trim().toLowerCase();
  const displayName = String(input.display_name || "").trim();
  const temporaryPassword = String(input.temporaryPassword || "");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return deny("Email invalide.", 400);
  if (!displayName || displayName.length > 120) return deny("Nom interne invalide.", 400);
  if (temporaryPassword.length < 8 || temporaryPassword.length > 256) {
    return deny("Mot de passe provisoire invalide.", 400);
  }
  return {
    ok: true,
    value: { email, display_name: displayName, temporaryPassword, role: "housekeeping" },
  };
}

export function validateHousekeepingUpdate(requester, target, updates = {}) {
  const allowed = canAdministerHousekeeping(requester, target);
  if (!allowed.ok) return allowed;
  const unknown = rejectUnknownFields(updates, updateFields);
  if (unknown) return unknown;

  const value = {};
  if (Object.hasOwn(updates, "display_name")) {
    const displayName = String(updates.display_name || "").trim();
    if (!displayName || displayName.length > 120) return deny("Nom interne invalide.", 400);
    value.display_name = displayName;
  }
  if (Object.hasOwn(updates, "is_active")) {
    if (typeof updates.is_active !== "boolean") return deny("Statut actif invalide.", 400);
    value.is_active = updates.is_active;
  }
  if (Object.keys(value).length === 0) return deny("Aucune modification autorisée fournie.", 400);
  return { ok: true, value };
}

export function canResetHousekeepingPassword(requester, target) {
  const allowed = canAdministerHousekeeping(requester, target);
  if (!allowed.ok) return allowed;
  if (target.is_active !== true) return deny("Le compte ménage doit être actif avant un reset.", 409);
  return { ok: true };
}
