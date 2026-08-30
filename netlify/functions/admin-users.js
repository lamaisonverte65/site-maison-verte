import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import {
  canAdministerHousekeeping,
  canResetHousekeepingPassword,
  isActiveAdminUsersAction,
  validateCreateHousekeeping,
  validateHousekeepingUpdate,
} from "./_lib/admin-user-policy.js";
import { provisionHousekeepingUser } from "./_lib/admin-user-service.js";
import { normalizeEmail } from "./_lib/normalize.js";

const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const publicUserFields = "id,email,display_name,role,is_owner,is_active,last_sign_in_at";
const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function publicProfile(profile) {
  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    role: profile.role,
    is_owner: profile.is_owner === true,
    is_active: profile.is_active === true,
    last_sign_in_at: profile.last_sign_in_at || null,
    auth_linked: Boolean(profile.auth_user_id),
  };
}

async function listAllAuthUsers() {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
  throw new Error("La liste Auth dépasse la limite de sécurité prévue.");
}

const authAdapter = {
  async findUserByEmail(email) {
    return (await listAllAuthUsers()).find((user) => normalizeEmail(user.email) === normalizeEmail(email)) || null;
  },
  async getUserById(id) {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error?.status === 404) return null;
    if (error) throw error;
    return data?.user || null;
  },
  async createUser(attributes) {
    const { data, error } = await supabase.auth.admin.createUser(attributes);
    if (error) throw error;
    return data.user;
  },
  async deleteUser(id) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
  },
  async updateUser(id, attributes) {
    const { data, error } = await supabase.auth.admin.updateUserById(id, attributes);
    if (error) throw error;
    return data.user;
  },
};

const repository = {
  async findProfileByEmail(email) {
    const { data, error } = await supabase.from("admin_users").select("*").eq("email", normalizeEmail(email)).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async findProfileById(id) {
    const { data, error } = await supabase.from("admin_users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async insertProfile(profile) {
    const { data, error } = await supabase.from("admin_users").insert(profile).select("*").single();
    if (error) throw error;
    return data;
  },
};

async function getTarget(userId) {
  if (!userId) return { result: { ok: false, statusCode: 400, error: "Identifiant utilisateur obligatoire." } };
  const target = await repository.findProfileById(userId);
  return target ? { target } : { result: { ok: false, statusCode: 404, error: "Utilisateur cible introuvable." } };
}

async function handleOwnerAction(auth, body) {
  if (!auth.isOwner) return { ok: false, statusCode: 403, error: "Droit propriétaire requis." };

  if (body.action === "list") {
    const { data, error } = await supabase.from("admin_users")
      .select(publicUserFields).in("role", ["owner", "housekeeping"])
      .order("is_owner", { ascending: false }).order("display_name", { ascending: true });
    if (error) throw error;
    return { ok: true, users: data || [], currentUser: publicProfile(auth.profile) };
  }

  if (body.action === "create_housekeeping") {
    const policy = validateCreateHousekeeping(auth.profile, body.user || {});
    if (!policy.ok) return policy;
    return provisionHousekeepingUser({ repository, auth: authAdapter, profile: policy.value, createdBy: auth.authUser.id });
  }

  const lookup = await getTarget(body.userId);
  if (lookup.result) return lookup.result;

  if (body.action === "update_housekeeping") {
    const policy = validateHousekeepingUpdate(auth.profile, lookup.target, body.updates || {});
    if (!policy.ok) return policy;
    const cleanUpdates = { ...policy.value, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("admin_users").update(cleanUpdates).eq("id", lookup.target.id);
    if (error) throw error;
    if (lookup.target.auth_user_id && cleanUpdates.display_name) {
      const authUser = await authAdapter.getUserById(lookup.target.auth_user_id);
      if (!authUser) return { ok: false, statusCode: 502, error: "Profil modifié, mais compte Auth introuvable.", authSyncRequired: true };
      await authAdapter.updateUser(lookup.target.auth_user_id, {
        user_metadata: { ...(authUser.user_metadata || {}), display_name: cleanUpdates.display_name, admin_role: "housekeeping" },
        app_metadata: { ...(authUser.app_metadata || {}), admin_role: "housekeeping" },
      });
    }
    return { ok: true };
  }

  if (body.action === "reset_housekeeping_password") {
    const policy = canResetHousekeepingPassword(auth.profile, lookup.target);
    if (!policy.ok) return policy;
    const password = String(body.temporaryPassword || "");
    if (password.length < 8 || password.length > 256) return { ok: false, statusCode: 400, error: "Mot de passe provisoire invalide." };
    if (!lookup.target.auth_user_id) return { ok: false, statusCode: 409, error: "Compte Auth non associé." };
    await authAdapter.updateUser(lookup.target.auth_user_id, { password });
    const { error } = await supabase.from("admin_users").update({
      password_initialized: false,
      temporary_password_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", lookup.target.id);
    if (error) throw error;
    return { ok: true };
  }

  if (body.action === "delete_housekeeping") {
    const policy = canAdministerHousekeeping(auth.profile, lookup.target);
    if (!policy.ok) return policy;
    const { error } = await supabase.from("admin_users").delete().eq("id", lookup.target.id);
    if (error) throw error;
    if (lookup.target.auth_user_id) {
      try { await authAdapter.deleteUser(lookup.target.auth_user_id); }
      catch { return { ok: true, warning: "Accès interne supprimé, mais le compte Auth doit être vérifié." }; }
    }
    return { ok: true };
  }

  return { ok: false, statusCode: 400, error: "Action inconnue." };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const auth = await authorizeAdminRequest(event, supabase);
    if (!auth.ok) return authorizationResponse(auth);
    const body = JSON.parse(event.body || "{}");
    const action = body.action || "me";
    if (!isActiveAdminUsersAction(action)) return json(400, { error: "Action inconnue." });
    if (action === "me") {
      await supabase.from("admin_users").update({ last_sign_in_at: new Date().toISOString() }).eq("id", auth.profile.id);
      return json(200, {
        ok: true,
        currentUser: publicProfile(auth.profile),
        canListUsers: auth.isOwner,
        authLinkRequired: auth.authLinkRequired,
      });
    }
    const result = await handleOwnerAction(auth, body);
    return json(result.ok === false ? (result.statusCode || 403) : 200, result.ok === false ? { error: result.error, ...result } : result);
  } catch (error) {
    console.error("Erreur gestion utilisateurs:", error);
    return json(500, { error: "Erreur gestion utilisateurs." });
  }
}
