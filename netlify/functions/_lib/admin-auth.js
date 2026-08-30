import {
  getEffectivePermissions,
  isHousekeepingProfile,
  isOwnerProfile,
} from "../../../shared/adminPermissions.js";
import { normalizeEmail } from "./normalize.js";

const bearerToken = (event) => {
  const header = event?.headers?.authorization || event?.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

export async function authorizeAdminRequest(event, supabase, { anyOf = [], ownerOnly = false } = {}) {
  const token = bearerToken(event);
  if (!token) return { ok: false, statusCode: 401, error: "Session admin manquante." };
  const { data, error } = await supabase.auth.getUser(token);
  const authUser = data?.user;
  const email = normalizeEmail(authUser?.email);
  if (error || !authUser?.id || !email) return { ok: false, statusCode: 401, error: "Session admin invalide." };

  const { data: linkedProfile, error: profileError } = await supabase
    .from("admin_users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (profileError) return { ok: false, statusCode: 500, error: "Impossible de vérifier les autorisations." };

  let profile = linkedProfile;
  let authBinding = "auth_user_id";
  let authLinkRequired = false;

  if (!profile) {
    const { data: ownerCandidates, error: ownerError } = await supabase
      .from("admin_users")
      .select("*")
      .eq("role", "owner")
      .eq("is_owner", true)
      .eq("is_active", true);
    if (ownerError) return { ok: false, statusCode: 500, error: "Impossible de vérifier les autorisations." };
    const candidate = Array.isArray(ownerCandidates) && ownerCandidates.length === 1 ? ownerCandidates[0] : null;
    if (candidate && candidate.auth_user_id == null && normalizeEmail(candidate.email) === email && isOwnerProfile(candidate)) {
      profile = candidate;
      authBinding = "transitional_owner_email";
      authLinkRequired = true;
    }
  }

  if (!profile || (!isOwnerProfile(profile) && !isHousekeepingProfile(profile))) {
    return { ok: false, statusCode: 403, error: "Compte admin non autorisé ou désactivé." };
  }
  if (authBinding === "auth_user_id" && profile.auth_user_id !== authUser.id) {
    return { ok: false, statusCode: 403, error: "Profil admin incompatible avec la session." };
  }

  const isOwner = isOwnerProfile(profile);
  const permissions = getEffectivePermissions(profile);
  if (ownerOnly && !isOwner) return { ok: false, statusCode: 403, error: "Droit propriétaire requis." };
  if (!ownerOnly && anyOf.length && !anyOf.some((permission) => permissions.has(permission))) return { ok: false, statusCode: 403, error: "Permission insuffisante." };
  return {
    ok: true,
    authUser,
    user: authUser,
    profile,
    permissions,
    isOwner,
    authBinding,
    authLinkRequired,
  };
}

export const authorizationResponse = (result) => ({
  statusCode: result.statusCode || 403,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: result.error || "Accès refusé." }),
});
