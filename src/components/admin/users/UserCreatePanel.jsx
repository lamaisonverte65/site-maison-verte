import { useMemo, useState } from "react";
import { styles } from "../adminStyles";
import { ADMIN_ROLES, getDefaultPermissionsForRole, getRoleLabel } from "../../../utils/adminPermissions";
import UserAccessMatrix from "./UserAccessMatrix";

function buildEmptyForm(role = ADMIN_ROLES.READ_ONLY) {
  return {
    display_name: "",
    email: "",
    role,
    temporaryPassword: "",
    permissions: getDefaultPermissionsForRole(role),
  };
}

function suggestPassword(name, email) {
  const base = String(name || email || "MaisonVerte").split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "MaisonVerte";
  return `${base}2026!`;
}

export default function UserCreatePanel({ mode = "standard", onCreateUser, onCancel }) {
  const isHousekeepingMode = mode === "housekeeping";
  const initialRole = isHousekeepingMode ? ADMIN_ROLES.HOUSEKEEPING : ADMIN_ROLES.READ_ONLY;
  const [form, setForm] = useState(() => buildEmptyForm(initialRole));
  const [loading, setLoading] = useState(false);

  const roleOptions = useMemo(() => [
    ADMIN_ROLES.ADMIN,
    ADMIN_ROLES.MANAGER,
    ADMIN_ROLES.READ_ONLY,
    ADMIN_ROLES.HOUSEKEEPING,
  ], []);

  function updateRole(role) {
    setForm({ ...form, role, permissions: getDefaultPermissionsForRole(role) });
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.display_name.trim()) return alert("Le nom interne est obligatoire.");
    if (!form.email.trim()) return alert("L'email est obligatoire.");
    if (!form.temporaryPassword || form.temporaryPassword.length < 8) return alert("Le mot de passe provisoire doit contenir au moins 8 caractères.");

    const payload = isHousekeepingMode
      ? {
          ...form,
          role: ADMIN_ROLES.HOUSEKEEPING,
          permissions: getDefaultPermissionsForRole(ADMIN_ROLES.HOUSEKEEPING),
        }
      : form;

    setLoading(true);
    try {
      await onCreateUser(payload);
      setForm(buildEmptyForm(initialRole));
      alert(isHousekeepingMode ? "Utilisateur ménage créé." : "Utilisateur créé.");
      onCancel?.();
    } catch (error) {
      alert("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={styles.reservationSheet}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>{isHousekeepingMode ? "Créer un utilisateur ménage" : "Créer un utilisateur"}</h3>
          <p style={styles.muted}>
            {isHousekeepingMode
              ? "Accès préconfiguré : Planning ménage, calendrier uniquement, fiche séjour simplifiée, téléphone, SMS et email."
              : "L'email sert d'identifiant. Le mot de passe provisoire pourra être changé par l'utilisateur après connexion."}
          </p>
        </div>
        <button type="button" style={styles.smallButton} onClick={onCancel}>Annuler</button>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: "14px" }}>
        <div style={styles.summaryGrid}>
          <label style={styles.label}>Nom interne
            <input style={styles.input} value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
          </label>
          <label style={styles.label}>Email / identifiant
            <input style={styles.input} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          {!isHousekeepingMode && (
            <label style={styles.label}>Rôle
              <select style={styles.input} value={form.role} onChange={(event) => updateRole(event.target.value)}>
                {roleOptions.map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
              </select>
            </label>
          )}
          {isHousekeepingMode && (
            <div style={styles.infoItem}>
              <span>Rôle</span>
              <strong>{getRoleLabel(ADMIN_ROLES.HOUSEKEEPING)}</strong>
            </div>
          )}
          <label style={styles.label}>Mot de passe provisoire
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={styles.input}
                type="text"
                value={form.temporaryPassword}
                onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })}
              />
              <button
                type="button"
                style={styles.smallButton}
                onClick={() => setForm({ ...form, temporaryPassword: suggestPassword(form.display_name, form.email) })}
              >
                Suggérer
              </button>
            </div>
          </label>
        </div>

        {isHousekeepingMode ? (
          <section style={styles.card}>
            <h4 style={styles.subTitle}>Accès préconfiguré</h4>
            <div style={styles.chipList}>
              <span style={styles.chip}>Planning ménage</span>
              <span style={styles.chip}>Calendrier uniquement</span>
              <span style={styles.chip}>Fiche séjour simplifiée</span>
              <span style={styles.chip}>Téléphone</span>
              <span style={styles.chip}>SMS</span>
              <span style={styles.chip}>Email</span>
            </div>
            <p style={styles.muted}>Aucune permission manuelle à configurer pour ce rôle système.</p>
          </section>
        ) : (
          <UserAccessMatrix value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
        )}
        <button style={styles.primaryButton} type="submit" disabled={loading}>{loading ? "Création..." : "Valider la création"}</button>
      </form>
    </section>
  );
}
