import { useState } from "react";
import { styles } from "../adminStyles";
import { ADMIN_PERMISSIONS, ADMIN_ROLES, getDefaultPermissionsForRole, getRoleLabel } from "../../../utils/adminPermissions";
import ChangePasswordPanel from "./ChangePasswordPanel";
import UserAccessMatrix from "./UserAccessMatrix";
import UserCreatePanel from "./UserCreatePanel";
import UserRoleBadge from "./UserRoleBadge";

export default function UsersPanel({ data, permissions }) {
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState("standard");
  const [editingUserId, setEditingUserId] = useState(null);
  const [draft, setDraft] = useState(null);
  const users = data.users || [];
  const canManageUsers = permissions?.isOwner || permissions?.can?.(ADMIN_PERMISSIONS.manageUsers);
  const canTransferOwnership = permissions?.isOwner || permissions?.can?.(ADMIN_PERMISSIONS.transferOwnership);
  const currentUserId = data.currentAdminUser?.id || "";
  const currentUserEmail = String(data.currentAdminUser?.email || "").toLowerCase();

  function isCurrentUser(user) {
    return Boolean(
      user?.id && user.id === currentUserId ||
      user?.email && String(user.email).toLowerCase() === currentUserEmail
    );
  }

  function canDeleteUser(user) {
    return Boolean(canManageUsers && user?.id && !user.is_owner && !isCurrentUser(user));
  }

  function startEdit(user) {
    setEditingUserId(user.id);
    setDraft({
      display_name: user.display_name || "",
      role: user.role || ADMIN_ROLES.READ_ONLY,
      permissions: Array.isArray(user.permissions) ? user.permissions : getDefaultPermissionsForRole(user.role),
    });
  }

  async function saveEdit(user) {
    try {
      await data.updateUser(user.id, draft);
      setEditingUserId(null);
      setDraft(null);
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function resetPassword(user) {
    const temporaryPassword = window.prompt(`Nouveau mot de passe provisoire pour ${user.email} :`, "MaisonVerte2026!");
    if (!temporaryPassword) return;
    if (temporaryPassword.length < 8) return alert("Mot de passe trop court.");
    try {
      await data.resetPassword(user.id, temporaryPassword);
      alert("Mot de passe provisoire mis à jour.");
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function transferOwnership(user) {
    if (!window.confirm(`Transférer la propriété à ${user.display_name || user.email} ? Cette action modifie les droits principaux.`)) return;
    try {
      await data.transferOwnership(user.id);
      alert("Propriété transférée.");
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function toggleActive(user) {
    try {
      await data.toggleActive(user);
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function deleteUser(user) {
    if (user.is_owner) return alert("Impossible de supprimer le compte propriétaire. Utilise d’abord le transfert de propriété / migration.");
    if (isCurrentUser(user)) return alert("Impossible de supprimer ton propre compte depuis la session en cours.");

    const label = user.display_name || user.email || "cet utilisateur";
    const confirmed = window.confirm(
      `Supprimer définitivement ${label} ?\n\nCette action supprime l’accès admin et, si possible, le compte d’authentification Supabase associé. Elle est irréversible.`
    );
    if (!confirmed) return;

    try {
      await data.deleteUser(user.id);
      if (editingUserId === user.id) {
        setEditingUserId(null);
        setDraft(null);
      }
      alert("Utilisateur supprimé.");
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Utilisateurs</h2>
          <p style={styles.muted}>Gestion des accès admin, rôles, permissions, propriétaire et mot de passe.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.refreshButton} onClick={data.reload}>Actualiser</button>
          {canManageUsers && (
            <>
              <button style={styles.addButton} onClick={() => { setCreateMode("standard"); setShowCreate(true); }}>Créer un utilisateur</button>
              <button style={styles.addButton} onClick={() => { setCreateMode("housekeeping"); setShowCreate(true); }}>Créer un utilisateur ménage</button>
            </>
          )}
        </div>
      </div>

      <ChangePasswordPanel onChangePassword={data.changeOwnPassword} />

      {data.error && <p style={styles.error}>{data.error}</p>}
      {data.loading && <p style={styles.info}>Chargement des utilisateurs...</p>}

      {showCreate && canManageUsers && (
        <UserCreatePanel mode={createMode} onCreateUser={data.createUser} onCancel={() => setShowCreate(false)} />
      )}

      <section style={styles.reservationSheet}>
        <h3 style={styles.subTitle}>Comptes autorisés</h3>
        {users.length === 0 ? (
          <p style={styles.empty}>Aucun utilisateur interne trouvé. Vérifie la table Supabase admin_users.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead style={styles.stickyHead}>
                <tr>
                  <th style={styles.th}>Nom</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Rôle</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Dernière connexion</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isEditing = editingUserId === user.id;
                  return (
                    <tr key={user.id}>
                      <td style={styles.td}>{isEditing ? <input style={styles.input} value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /> : (user.display_name || "-")}</td>
                      <td style={styles.td}>{user.email}</td>
                      <td style={styles.td}>{isEditing ? (
                        <select style={styles.input} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value, permissions: getDefaultPermissionsForRole(event.target.value) })}>
                          <option value={ADMIN_ROLES.ADMIN}>{getRoleLabel(ADMIN_ROLES.ADMIN)}</option>
                          <option value={ADMIN_ROLES.MANAGER}>{getRoleLabel(ADMIN_ROLES.MANAGER)}</option>
                          <option value={ADMIN_ROLES.READ_ONLY}>{getRoleLabel(ADMIN_ROLES.READ_ONLY)}</option>
                          <option value={ADMIN_ROLES.HOUSEKEEPING}>{getRoleLabel(ADMIN_ROLES.HOUSEKEEPING)}</option>
                        </select>
                      ) : <UserRoleBadge role={user.role} isOwner={user.is_owner} />}</td>
                      <td style={styles.td}>{user.is_active ? "Actif" : "Désactivé"}</td>
                      <td style={styles.td}>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("fr-FR") : "-"}</td>
                      <td style={styles.td}>
                        <div style={styles.contactButtons}>
                          {canManageUsers && !isEditing && <button style={styles.smallButton} onClick={() => startEdit(user)}>Modifier</button>}
                          {canManageUsers && isEditing && <button style={styles.acceptButton} onClick={() => saveEdit(user)}>Enregistrer</button>}
                          {canManageUsers && isEditing && <button style={styles.smallButton} onClick={() => { setEditingUserId(null); setDraft(null); }}>Annuler</button>}
                          {canManageUsers && <button style={styles.smallButton} onClick={() => resetPassword(user)}>Réinitialiser MDP</button>}
                          {canManageUsers && !user.is_owner && !isCurrentUser(user) && <button style={user.is_active ? styles.warningButton : styles.smallButton} onClick={() => toggleActive(user)}>{user.is_active ? "Désactiver" : "Activer"}</button>}
                          {canTransferOwnership && !user.is_owner && <button style={styles.deleteButton} onClick={() => transferOwnership(user)}>Transférer propriété</button>}
                          {canDeleteUser(user) && <button style={styles.deleteButton} onClick={() => deleteUser(user)}>Supprimer</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingUserId && draft && (
        <section style={styles.reservationSheet}>
          <h3 style={styles.subTitle}>Permissions de l'utilisateur sélectionné</h3>
          <UserAccessMatrix value={draft.permissions} onChange={(permissions) => setDraft({ ...draft, permissions })} />
        </section>
      )}
    </section>
  );
}
