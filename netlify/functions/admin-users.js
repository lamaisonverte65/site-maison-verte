import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

function getOwnerEmails() {
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function getRequester(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, statusCode: 401, error: "Session admin manquante." };

  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  const email = normalizeEmail(user?.email);
  if (error || !email) return { ok: false, statusCode: 401, error: "Session admin invalide." };

  const ownerEmails = getOwnerEmails();
  const isEnvOwner = ownerEmails.includes(email);

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (adminError && adminError.code !== "PGRST116") {
    return { ok: false, statusCode: 500, error: adminError.message };
  }

  if (!adminUser && isEnvOwner) {
    return { ok: true, authUser: user, adminUser: { email, role: "owner", is_owner: true, is_active: true, permissions: [] } };
  }

  if (!adminUser || adminUser.is_active === false) {
    return { ok: false, statusCode: 403, error: "Compte admin non autorisé ou désactivé." };
  }

  await supabase.from("admin_users").update({ last_sign_in_at: new Date().toISOString() }).eq("id", adminUser.id);

  return { ok: true, authUser: user, adminUser: { ...adminUser, is_owner: adminUser.is_owner || isEnvOwner } };
}

function hasPermission(adminUser, permission) {
  if (adminUser?.is_owner || adminUser?.role === "owner") return true;
  return Array.isArray(adminUser?.permissions) && adminUser.permissions.includes(permission);
}

function requireManageUsers(requester) {
  if (!hasPermission(requester.adminUser, "manage:users")) {
    return { ok: false, statusCode: 403, error: "Droit gestion utilisateurs requis." };
  }
  return { ok: true };
}

function requireOwner(requester) {
  if (!(requester.adminUser?.is_owner || requester.adminUser?.role === "owner")) {
    return { ok: false, statusCode: 403, error: "Droit propriétaire requis." };
  }
  return { ok: true };
}

async function findAuthUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users || []).find((user) => normalizeEmail(user.email) === email) || null;
}

async function createOrUpdateAuthUser({ email, password, role, displayName }) {
  const existing = await findAuthUserByEmail(email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), admin_role: role, display_name: displayName },
      app_metadata: { ...(existing.app_metadata || {}), admin_role: role },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { admin_role: role, display_name: displayName },
    app_metadata: { admin_role: role },
  });
  if (error) throw error;
  return data.user;
}

async function listUsers(requester) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .order("is_owner", { ascending: false })
    .order("display_name", { ascending: true });
  if (error) throw error;

  const currentEmail = normalizeEmail(requester.authUser.email);
  return {
    users: data || [],
    currentUser: (data || []).find((user) => normalizeEmail(user.email) === currentEmail) || requester.adminUser,
  };
}

async function createUser(requester, user) {
  const allowed = requireManageUsers(requester);
  if (!allowed.ok) return allowed;

  const email = normalizeEmail(user.email);
  const displayName = String(user.display_name || "").trim();
  const role = user.role || "read_only";
  const temporaryPassword = String(user.temporaryPassword || "");
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  if (!email) return { ok: false, statusCode: 400, error: "Email obligatoire." };
  if (!displayName) return { ok: false, statusCode: 400, error: "Nom interne obligatoire." };
  if (temporaryPassword.length < 8) return { ok: false, statusCode: 400, error: "Mot de passe provisoire trop court." };

  const authUser = await createOrUpdateAuthUser({ email, password: temporaryPassword, role, displayName });

  const { error } = await supabase.from("admin_users").upsert({
    email,
    display_name: displayName,
    role,
    permissions,
    is_owner: role === "owner" ? false : Boolean(user.is_owner),
    is_active: true,
    auth_user_id: authUser.id,
    password_initialized: false,
    temporary_password_set_at: new Date().toISOString(),
    created_by: requester.authUser.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });

  if (error) throw error;
  return { ok: true };
}

async function updateUser(requester, userId, updates) {
  const allowed = requireManageUsers(requester);
  if (!allowed.ok) return allowed;

  const cleanUpdates = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(updates, "display_name")) cleanUpdates.display_name = String(updates.display_name || "").trim();
  if (Object.prototype.hasOwnProperty.call(updates, "role")) cleanUpdates.role = updates.role;
  if (Object.prototype.hasOwnProperty.call(updates, "permissions")) cleanUpdates.permissions = Array.isArray(updates.permissions) ? updates.permissions : [];
  if (Object.prototype.hasOwnProperty.call(updates, "is_active")) cleanUpdates.is_active = Boolean(updates.is_active);

  const { data: target, error: targetError } = await supabase.from("admin_users").select("*").eq("id", userId).single();
  if (targetError) throw targetError;
  if (target.is_owner && cleanUpdates.is_active === false) return { ok: false, statusCode: 400, error: "Impossible de désactiver le propriétaire." };

  const { error } = await supabase.from("admin_users").update(cleanUpdates).eq("id", userId);
  if (error) throw error;

  if (target.auth_user_id && cleanUpdates.role) {
    await supabase.auth.admin.updateUserById(target.auth_user_id, {
      app_metadata: { admin_role: cleanUpdates.role },
      user_metadata: { admin_role: cleanUpdates.role, display_name: cleanUpdates.display_name || target.display_name },
    });
  }

  return { ok: true };
}

async function resetPassword(requester, userId, temporaryPassword) {
  const allowed = requireManageUsers(requester);
  if (!allowed.ok) return allowed;
  const password = String(temporaryPassword || "");
  if (password.length < 8) return { ok: false, statusCode: 400, error: "Mot de passe provisoire trop court." };

  const { data: target, error: targetError } = await supabase.from("admin_users").select("*").eq("id", userId).single();
  if (targetError) throw targetError;

  let authUserId = target.auth_user_id;
  if (!authUserId) {
    const authUser = await findAuthUserByEmail(normalizeEmail(target.email));
    authUserId = authUser?.id;
  }
  if (!authUserId) return { ok: false, statusCode: 404, error: "Utilisateur Auth introuvable." };

  const { error } = await supabase.auth.admin.updateUserById(authUserId, { password });
  if (error) throw error;

  await supabase.from("admin_users").update({
    auth_user_id: authUserId,
    password_initialized: false,
    temporary_password_set_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  return { ok: true };
}

async function deleteUser(requester, userId) {
  const allowed = requireManageUsers(requester);
  if (!allowed.ok) return allowed;

  if (!userId) return { ok: false, statusCode: 400, error: "Identifiant utilisateur obligatoire." };

  const { data: target, error: targetError } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", userId)
    .single();
  if (targetError) throw targetError;

  const requesterEmail = normalizeEmail(requester.authUser?.email);
  const targetEmail = normalizeEmail(target.email);

  if (target.is_owner || target.role === "owner") {
    return { ok: false, statusCode: 400, error: "Impossible de supprimer le compte propriétaire. Utilise d’abord le transfert de propriété / migration." };
  }

  if (targetEmail && targetEmail === requesterEmail) {
    return { ok: false, statusCode: 400, error: "Impossible de supprimer ton propre compte." };
  }

  const ownerEmails = getOwnerEmails();
  if (targetEmail && ownerEmails.includes(targetEmail)) {
    return { ok: false, statusCode: 400, error: "Impossible de supprimer un compte propriétaire défini dans la configuration." };
  }

  let authUserId = target.auth_user_id;
  if (!authUserId && targetEmail) {
    const authUser = await findAuthUserByEmail(targetEmail);
    authUserId = authUser?.id || null;
  }

  const { error: deleteAdminUserError } = await supabase
    .from("admin_users")
    .delete()
    .eq("id", userId);
  if (deleteAdminUserError) throw deleteAdminUserError;

  if (authUserId) {
    const { error: deleteAuthUserError } = await supabase.auth.admin.deleteUser(authUserId);
    if (deleteAuthUserError) {
      return {
        ok: true,
        warning: `Accès admin supprimé, mais suppression Auth Supabase impossible : ${deleteAuthUserError.message}`,
      };
    }
  }

  return { ok: true };
}

async function transferOwner(requester, userId) {
  const allowed = requireOwner(requester);
  if (!allowed.ok) return allowed;

  const { data: target, error: targetError } = await supabase.from("admin_users").select("*").eq("id", userId).single();
  if (targetError) throw targetError;
  if (!target.is_active) return { ok: false, statusCode: 400, error: "Impossible de transférer à un utilisateur désactivé." };

  const { error: clearError } = await supabase.from("admin_users").update({ is_owner: false, role: "admin", updated_at: new Date().toISOString() }).eq("is_owner", true);
  if (clearError) throw clearError;

  const { error } = await supabase.from("admin_users").update({
    is_owner: true,
    role: "owner",
    permissions: [],
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (error) throw error;

  if (target.auth_user_id) {
    await supabase.auth.admin.updateUserById(target.auth_user_id, {
      app_metadata: { admin_role: "owner" },
      user_metadata: { admin_role: "owner", display_name: target.display_name },
    });
  }

  return { ok: true };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const requester = await getRequester(event);
    if (!requester.ok) return json(requester.statusCode, { error: requester.error });

    const body = JSON.parse(event.body || "{}");
    const action = body.action || "list";

    let result;
    if (action === "list") result = await listUsers(requester);
    if (action === "create") result = await createUser(requester, body.user || {});
    if (action === "update") result = await updateUser(requester, body.userId, body.updates || {});
    if (action === "reset_password") result = await resetPassword(requester, body.userId, body.temporaryPassword);
    if (action === "delete") result = await deleteUser(requester, body.userId);
    if (action === "transfer_owner") result = await transferOwner(requester, body.userId);

    if (!result) return json(400, { error: "Action inconnue." });
    if (result.ok === false) return json(result.statusCode || 400, { error: result.error });

    return json(200, result);
  } catch (error) {
    return json(500, { error: error.message || "Erreur gestion utilisateurs." });
  }
}
