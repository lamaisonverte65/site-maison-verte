import { useState } from "react";
import { styles } from "../adminStyles";
import { ADMIN_ROLES } from "../../../utils/adminPermissions";
import { buildHousekeepingUpdatePayload } from "../../../utils/adminUserForm";
import ChangePasswordPanel from "./ChangePasswordPanel";
import UserCreatePanel from "./UserCreatePanel";
import UserRoleBadge from "./UserRoleBadge";

export default function UsersPanel({ data, permissions }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const users = data.users || [];
  const canManageUsers = permissions?.isOwner === true;

  function startEdit(user) {
    setEditingUserId(user.id);
    setDisplayName(user.display_name || "");
  }

  async function saveEdit(user) {
    const updates = buildHousekeepingUpdatePayload({ display_name: displayName });
    if (!updates.display_name) return alert("Le nom interne est obligatoire.");
    try {
      await data.updateHousekeeping(user.id, updates);
      setEditingUserId(null);
    } catch (error) {
      alert(`Erreur : ${error.message}`);
    }
  }

  async function resetPassword(user) {
    const temporaryPassword = window.prompt(`Nouveau mot de passe provisoire pour ${user.email} :`, "MaisonVerte2026!");
    if (!temporaryPassword) return;
    if (temporaryPassword.length < 8) return alert("Mot de passe trop court.");
    try {
      await data.resetHousekeepingPassword(user.id, temporaryPassword);
      alert("Mot de passe provisoire mis à jour.");
    } catch (error) {
      alert(`Erreur : ${error.message}`);
    }
  }

  async function deleteHousekeeping(user) {
    const label = user.display_name || user.email || "ce compte ménage";
    if (!window.confirm(`Supprimer définitivement ${label} ?\n\nLa désactivation est recommandée. Cette suppression d’accès est irréversible.`)) return;
    try {
      await data.deleteHousekeeping(user.id);
    } catch (error) {
      alert(`Erreur : ${error.message}`);
    }
  }

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Utilisateurs</h2>
          <p style={styles.muted}>Propriétaire protégé et comptes ménage à accès opérationnel fixe.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.refreshButton} onClick={data.reload}>Actualiser</button>
          {canManageUsers && <button style={styles.addButton} onClick={() => setShowCreate(true)}>Créer un compte ménage</button>}
        </div>
      </div>

      <ChangePasswordPanel onChangePassword={data.changeOwnPassword} />
      {data.error && <p style={styles.error}>{data.error}</p>}
      {data.loading && <p style={styles.info}>Chargement des utilisateurs...</p>}
      {showCreate && canManageUsers && (
        <UserCreatePanel onCreateHousekeeping={data.createHousekeeping} onCancel={() => setShowCreate(false)} />
      )}

      <section style={styles.reservationSheet}>
        <h3 style={styles.subTitle}>Comptes autorisés</h3>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}><tr>
              <th style={styles.th}>Nom</th><th style={styles.th}>Email</th><th style={styles.th}>Rôle</th>
              <th style={styles.th}>Statut</th><th style={styles.th}>Dernière connexion</th><th style={styles.th}>Actions</th>
            </tr></thead>
            <tbody>{users.map((user) => {
              const isOwner = user.is_owner || user.role === ADMIN_ROLES.OWNER;
              const isEditing = editingUserId === user.id;
              return <tr key={user.id}>
                <td style={styles.td}>{isEditing
                  ? <input style={styles.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                  : (user.display_name || "-")}</td>
                <td style={styles.td}>{user.email}</td>
                <td style={styles.td}><UserRoleBadge role={user.role} isOwner={isOwner} /></td>
                <td style={styles.td}>{user.is_active ? "Actif" : "Désactivé"}</td>
                <td style={styles.td}>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("fr-FR") : "-"}</td>
                <td style={styles.td}><div style={styles.contactButtons}>
                  {isOwner ? <span style={styles.muted}>Compte protégé</span> : canManageUsers && <>
                    {!isEditing && <button style={styles.smallButton} onClick={() => startEdit(user)}>Renommer</button>}
                    {isEditing && <button style={styles.acceptButton} onClick={() => saveEdit(user)}>Enregistrer</button>}
                    {isEditing && <button style={styles.smallButton} onClick={() => setEditingUserId(null)}>Annuler</button>}
                    <button style={styles.smallButton} onClick={() => resetPassword(user)}>Réinitialiser MDP</button>
                    <button style={user.is_active ? styles.warningButton : styles.smallButton} onClick={() => data.toggleActive(user)}>{user.is_active ? "Désactiver" : "Réactiver"}</button>
                    <button style={styles.deleteButton} onClick={() => deleteHousekeeping(user)}>Supprimer</button>
                  </>}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
