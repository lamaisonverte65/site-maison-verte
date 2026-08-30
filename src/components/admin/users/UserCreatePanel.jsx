import { useState } from "react";
import { styles } from "../adminStyles";
import { buildHousekeepingCreationPayload } from "../../../utils/adminUserForm";

const emptyForm = () => ({ display_name: "", email: "", temporaryPassword: "" });

function suggestPassword(name, email) {
  const base = String(name || email || "MaisonVerte").split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "MaisonVerte";
  return `${base}2026!`;
}

export default function UserCreatePanel({ onCreateHousekeeping, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const payload = buildHousekeepingCreationPayload(form);
    if (!payload.display_name) return alert("Le nom interne est obligatoire.");
    if (!payload.email) return alert("L’email est obligatoire.");
    if (payload.temporaryPassword.length < 8) return alert("Le mot de passe provisoire doit contenir au moins 8 caractères.");
    setLoading(true);
    try {
      await onCreateHousekeeping(payload);
      setForm(emptyForm());
      alert("Compte ménage créé.");
      onCancel?.();
    } catch (error) {
      alert(`Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={styles.reservationSheet}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Créer un compte ménage</h3>
          <p style={styles.muted}>Ce compte reçoit automatiquement l’accès opérationnel fixe, sans données financières.</p>
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
          <label style={styles.label}>Mot de passe provisoire
            <div style={{ display: "flex", gap: "8px" }}>
              <input style={styles.input} type="text" value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} />
              <button type="button" style={styles.smallButton} onClick={() => setForm({ ...form, temporaryPassword: suggestPassword(form.display_name, form.email) })}>Suggérer</button>
            </div>
          </label>
        </div>
        <section style={styles.card}>
          <h4 style={styles.subTitle}>Accès système fixe</h4>
          <p style={styles.muted}>Calendrier, informations d’accueil, contacts, messages utiles, horaires et notes opérationnelles. Aucun prix ni paiement.</p>
        </section>
        <button style={styles.primaryButton} type="submit" disabled={loading}>{loading ? "Création..." : "Créer le compte ménage"}</button>
      </form>
    </section>
  );
}
