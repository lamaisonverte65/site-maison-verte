import { useMemo, useState } from "react";
import { useCustomerSearch } from "../../hooks/useCustomerSearch";
import { styles } from "./adminStyles";

function normalize(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function customerName(customer = {}) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Client sans nom";
}

export default function CustomerCreateModal({ onClose, onCreate, onOpenExisting }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", postalCode: "", city: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { results, loading } = useCustomerSearch({ firstName: form.firstName, lastName: form.lastName, minLength: 2, limit: 6 });

  const exactDuplicate = useMemo(() => results.find((customer) => (
    normalize(customer.first_name) === normalize(form.firstName)
    && normalize(customer.last_name) === normalize(form.lastName)
  )), [results, form.firstName, form.lastName]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Le prénom et le nom sont obligatoires.");
      return;
    }
    if (exactDuplicate) {
      setError("Un client portant exactement ce prénom et ce nom existe déjà. Ouvre sa fiche pour éviter un doublon.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created = await onCreate(form);
      if (created) onOpenExisting(created);
      onClose();
    } catch (createError) {
      setError(createError?.message || "Impossible de créer le client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.modalOverlay}>
      <form style={{ ...styles.modal, maxWidth: "620px" }} onSubmit={submit}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0 }}>Ajouter un client</h2>
          <button type="button" style={styles.closeButton} disabled={saving} onClick={onClose}>×</button>
        </div>
        <p style={styles.muted}>Recherche d'abord les clients existants pendant la saisie afin d'éviter les doublons.</p>

        <label style={styles.label}>Prénom *<input style={styles.input} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} autoFocus /></label>
        <label style={styles.label}>Nom *<input style={styles.input} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></label>
        <label style={styles.label}>Email<input type="email" style={styles.input} value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
        <label style={styles.label}>Téléphone<input style={styles.input} value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label>
        <label style={styles.label}>Adresse<input style={styles.input} value={form.address} onChange={(e) => update("address", e.target.value)} /></label>
        <label style={styles.label}>Code postal<input style={styles.input} value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></label>
        <label style={styles.label}>Ville<input style={styles.input} value={form.city} onChange={(e) => update("city", e.target.value)} /></label>
        <label style={styles.label}>Pays<input style={styles.input} value={form.country} onChange={(e) => update("country", e.target.value)} /></label>

        {(loading || results.length > 0) && (
          <div style={{ ...styles.historyBox, marginTop: "18px" }}>
            <strong>Clients existants possibles</strong>
            {loading ? <p style={styles.muted}>Recherche…</p> : results.map((customer) => (
              <div key={customer.id} style={{ ...styles.historyItem, display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginTop: "8px" }}>
                <div><strong>{customerName(customer)}</strong><div style={styles.muted}>{[customer.email, customer.phone].filter(Boolean).join(" · ") || "Aucune coordonnée"}</div></div>
                <button type="button" style={styles.smallButton} onClick={() => { onOpenExisting(customer); onClose(); }}>Ouvrir ce client</button>
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ ...styles.error, marginTop: "16px" }}>{error}</p>}
        <div style={styles.modalActions}>
          <button type="button" style={styles.smallButton} disabled={saving} onClick={onClose}>Annuler</button>
          <button type="submit" style={styles.addButton} disabled={saving || Boolean(exactDuplicate)}>{saving ? "Création…" : "Créer le client"}</button>
        </div>
      </form>
    </div>
  );
}
