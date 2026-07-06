import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function callAdminUsersApi(payload) {
  const response = await fetch("/.netlify/functions/admin-users", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || text || "Erreur gestion utilisateurs.");
  return data;
}

export function useAdminUsers({ session } = {}) {
  const [users, setUsers] = useState([]);
  const [currentAdminUser, setCurrentAdminUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentEmail = session?.user?.email?.toLowerCase() || "";

  const loadUsers = useCallback(async () => {
    if (!session) {
      setUsers([]);
      setCurrentAdminUser(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await callAdminUsersApi({ action: "list" });
      const nextUsers = data.users || [];
      setUsers(nextUsers);
      setCurrentAdminUser(
        data.currentUser || nextUsers.find((user) => String(user.email || "").toLowerCase() === currentEmail) || null
      );
    } catch (error) {
      setError(error.message || "Erreur chargement utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, [session, currentEmail]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function createUser(values) {
    await callAdminUsersApi({ action: "create", user: values });
    await loadUsers();
  }

  async function updateUser(userId, values) {
    await callAdminUsersApi({ action: "update", userId, updates: values });
    await loadUsers();
  }

  async function resetPassword(userId, temporaryPassword) {
    await callAdminUsersApi({ action: "reset_password", userId, temporaryPassword });
    await loadUsers();
  }

  async function transferOwnership(userId) {
    await callAdminUsersApi({ action: "transfer_owner", userId });
    await loadUsers();
  }

  async function toggleActive(user) {
    await updateUser(user.id, { is_active: !user.is_active });
  }

  async function deleteUser(userId) {
    await callAdminUsersApi({ action: "delete", userId });
    await loadUsers();
  }

  async function changeOwnPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  return useMemo(() => ({
    users,
    currentAdminUser,
    loading,
    error,
    reload: loadUsers,
    createUser,
    updateUser,
    resetPassword,
    transferOwnership,
    toggleActive,
    deleteUser,
    changeOwnPassword,
  }), [users, currentAdminUser, loading, error, loadUsers]);
}
