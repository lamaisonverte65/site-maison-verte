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

  const loadUsers = useCallback(async () => {
    if (!session) {
      setUsers([]);
      setCurrentAdminUser(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const profileData = await callAdminUsersApi({ action: "me" });
      const currentUser = profileData.currentUser || null;
      setCurrentAdminUser(currentUser);
      if (profileData.canListUsers) {
        const listData = await callAdminUsersApi({ action: "list" });
        setUsers(listData.users || []);
      } else {
        setUsers([]);
      }
    } catch (error) {
      setUsers([]);
      setCurrentAdminUser(null);
      setError(error.message || "Erreur chargement utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function createHousekeeping(values) {
    await callAdminUsersApi({ action: "create_housekeeping", user: values });
    await loadUsers();
  }

  async function updateHousekeeping(userId, values) {
    await callAdminUsersApi({ action: "update_housekeeping", userId, updates: values });
    await loadUsers();
  }

  async function resetHousekeepingPassword(userId, temporaryPassword) {
    await callAdminUsersApi({ action: "reset_housekeeping_password", userId, temporaryPassword });
    await loadUsers();
  }

  async function toggleActive(user) {
    await updateHousekeeping(user.id, { is_active: !user.is_active });
  }

  async function deleteHousekeeping(userId) {
    await callAdminUsersApi({ action: "delete_housekeeping", userId });
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
    createHousekeeping,
    updateHousekeeping,
    resetHousekeepingPassword,
    toggleActive,
    deleteHousekeeping,
    changeOwnPassword,
  }), [users, currentAdminUser, loading, error, loadUsers]);
}
