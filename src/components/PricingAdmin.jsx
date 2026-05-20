import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function emptySeason() {
  return {
    id: null,
    label: "",
    startDate: "",
    endDate: "",
    nightPrice: "",
    minimumNights: "6",
    notes: "",
  };
}

function emptyOverride() {
  return {
    id: null,
    label: "",
    startDate: "",
    endDate: "",
    nightPrice: "",
    reason: "ajustement",
    notes: "",
  };
}

export default function PricingAdmin() {
  const [defaultNightPrice, setDefaultNightPrice] = useState(80);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState([]);
  const [seasonForm, setSeasonForm] = useState(emptySeason());
  const [overrideForm, setOverrideForm] = useState(emptyOverride());
  const [defaultPriceModal, setDefaultPriceModal] = useState(null);
  const [activeEditor, setActiveEditor] = useState("season");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPricing();
  }, []);

  async function getAdminFetchHeaders() {
    const { data: { session } } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  async function loadPricing() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/.netlify/functions/get-pricing");
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erreur chargement tarifs");

      setDefaultNightPrice(Number(data.defaultNightPrice || 80));
      setSeasonPrices(data.seasonPrices || []);
      setPriceOverrides(data.priceOverrides || []);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  function openDefaultPriceModal() {
    setDefaultPriceModal({
      nightPrice: String(defaultNightPrice || 80),
      notes: "Tarif par défaut",
    });
  }

  async function saveDefaultPrice(event) {
    event.preventDefault();

    if (!defaultPriceModal) return;

    const value = Number(defaultPriceModal.nightPrice || 0);
    if (!value || value <= 0) return alert("Entre un tarif par défaut valide.");

    setSaving(true);

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({
          action: "update_default_price",
          defaultNightPrice: value,
          notes: defaultPriceModal.notes || "Tarif par défaut",
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      setDefaultPriceModal(null);
      await loadPricing();
    } catch (err) {
      alert("Erreur tarif par défaut : " + err.message);
    }

    setSaving(false);
  }

  function editSeason(rule) {
    setActiveEditor("season");
    setSeasonForm({
      id: rule?.id || null,
      label: rule?.label || "",
      startDate: rule?.start_date || "",
      endDate: rule?.end_date || "",
      nightPrice: rule?.night_price ?? "",
      minimumNights: rule?.minimum_nights ?? "6",
      notes: rule?.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editOverride(rule) {
    setActiveEditor("override");
    setOverrideForm({
      id: rule?.id || null,
      label: rule?.label || "",
      startDate: rule?.start_date || "",
      endDate: rule?.end_date || "",
      nightPrice: rule?.night_price ?? "",
      reason: rule?.reason || "ajustement",
      notes: rule?.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) return false;
    return startDate < endDate;
  }

  async function saveSeason(event) {
    event.preventDefault();

    if (!validateDateRange(seasonForm.startDate, seasonForm.endDate)) return alert("La date de fin doit être après la date de début.");
    if (!Number(seasonForm.nightPrice) || Number(seasonForm.nightPrice) <= 0) return alert("Entre un prix par nuit valide.");

    setSaving(true);

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({
          action: seasonForm.id ? "update" : "create",
          ruleType: "season",
          id: seasonForm.id,
          label: seasonForm.label,
          startDate: seasonForm.startDate,
          endDate: seasonForm.endDate,
          nightPrice: Number(seasonForm.nightPrice),
          minimumNights: seasonForm.minimumNights === "" ? null : Number(seasonForm.minimumNights),
          allowedArrivalDays: [0, 6],
          notes: seasonForm.notes,
          isActive: true,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      setSeasonForm(emptySeason());
      await loadPricing();
    } catch (err) {
      alert("Erreur saison : " + err.message);
    }

    setSaving(false);
  }

  async function saveOverride(event) {
    event.preventDefault();

    if (!validateDateRange(overrideForm.startDate, overrideForm.endDate)) return alert("La date de fin doit être après la date de début.");
    if (!Number(overrideForm.nightPrice) || Number(overrideForm.nightPrice) <= 0) return alert("Entre un prix par nuit valide.");

    setSaving(true);

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({
          action: overrideForm.id ? "update" : "create",
          ruleType: "override",
          id: overrideForm.id,
          label: overrideForm.label,
          startDate: overrideForm.startDate,
          endDate: overrideForm.endDate,
          nightPrice: Number(overrideForm.nightPrice),
          reason: overrideForm.reason,
          notes: overrideForm.notes,
          isActive: true,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      setOverrideForm(emptyOverride());
      await loadPricing();
    } catch (err) {
      alert("Erreur tarif spécifique : " + err.message);
    }

    setSaving(false);
  }

  async function deleteRule(ruleType, id) {
    if (!window.confirm("Supprimer cette règle de prix ?")) return;

    setSaving(true);

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "delete", ruleType, id }),
      });

      if (!response.ok) throw new Error(await response.text());

      await loadPricing();
    } catch (err) {
      alert("Erreur suppression : " + err.message);
    }

    setSaving(false);
  }

  const sortedSeasonPrices = useMemo(
    () => [...seasonPrices].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))),
    [seasonPrices]
  );

  const sortedOverrides = useMemo(
    () => [...priceOverrides].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))),
    [priceOverrides]
  );

  return (
    <div style={styles.wrapper}>
      {loading && <p>Chargement des tarifs...</p>}
      {saving && <p style={styles.info}>Enregistrement en cours...</p>}
      {error && <p style={styles.error}>Erreur : {error}</p>}

      <section style={styles.cardPremium}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Base tarifaire</p>
            <h3 style={styles.cardTitle}>Tarif par défaut</h3>
            <p style={styles.muted}>Utilisé hors saison et hors tarif spécifique.</p>
          </div>
          <button style={styles.primaryButton} onClick={openDefaultPriceModal}>Modifier</button>
        </div>
        <strong style={styles.bigPrice}>{formatMoney(defaultNightPrice)} / nuit</strong>
        <p style={styles.muted}>Priorité appliquée partout : tarif spécifique → tarif saisonnier → tarif par défaut.</p>
      </section>

      <section style={styles.editorCard}>
        <div style={styles.switchRow}>
          <button style={activeEditor === "season" ? styles.activeSwitch : styles.switchButton} onClick={() => setActiveEditor("season")}>Saisons</button>
          <button style={activeEditor === "override" ? styles.activeSwitch : styles.switchButton} onClick={() => setActiveEditor("override")}>Tarifs spécifiques</button>
        </div>

        {activeEditor === "season" ? (
          <SeasonEditor form={seasonForm} setForm={setSeasonForm} onSubmit={saveSeason} onCancel={() => setSeasonForm(emptySeason())} saving={saving} />
        ) : (
          <OverrideEditor form={overrideForm} setForm={setOverrideForm} onSubmit={saveOverride} onCancel={() => setOverrideForm(emptyOverride())} saving={saving} />
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3>Tarifs saisonniers</h3>
            <p style={styles.muted}>Vacances, haute saison, périodes scolaires ou périodes récurrentes.</p>
          </div>
          <button style={styles.secondaryButton} onClick={() => { setActiveEditor("season"); setSeasonForm(emptySeason()); }}>Nouvelle saison</button>
        </div>

        {sortedSeasonPrices.length === 0 ? <p style={styles.muted}>Aucun tarif saisonnier enregistré.</p> : (
          <div style={styles.grid}>
            {sortedSeasonPrices.map((rule) => (
              <div key={rule.id} style={styles.ruleCard}>
                <div style={styles.ruleTop}><strong>{rule.label}</strong><span style={styles.badgeBlue}>Saison</span></div>
                <p style={styles.muted}>{formatDate(rule.start_date)} → {formatDate(rule.end_date)}</p>
                <strong style={styles.rulePrice}>{formatMoney(rule.night_price)} / nuit</strong>
                {rule.minimum_nights && <p style={styles.muted}>Minimum : {rule.minimum_nights} nuits</p>}
                {rule.notes && <p style={styles.notes}>{rule.notes}</p>}
                <div style={styles.actions}>
                  <button style={styles.smallButton} onClick={() => editSeason(rule)}>Modifier</button>
                  <button style={styles.deleteButton} onClick={() => deleteRule("season", rule.id)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3>Tarifs spécifiques</h3>
            <p style={styles.muted}>Prioritaires sur les saisons : promo, pont, événement, ajustement ponctuel.</p>
          </div>
          <button style={styles.secondaryButton} onClick={() => { setActiveEditor("override"); setOverrideForm(emptyOverride()); }}>Nouveau tarif spécifique</button>
        </div>

        {sortedOverrides.length === 0 ? <p style={styles.muted}>Aucun tarif spécifique enregistré.</p> : (
          <div style={styles.grid}>
            {sortedOverrides.map((rule) => (
              <div key={rule.id} style={styles.ruleCard}>
                <div style={styles.ruleTop}><strong>{rule.label}</strong><span style={styles.badgeGreen}>Prioritaire</span></div>
                <p style={styles.muted}>{formatDate(rule.start_date)} → {formatDate(rule.end_date)}</p>
                <strong style={styles.rulePrice}>{formatMoney(rule.night_price)} / nuit</strong>
                {rule.reason && <p style={styles.muted}>Motif : {rule.reason}</p>}
                {rule.notes && <p style={styles.notes}>{rule.notes}</p>}
                <div style={styles.actions}>
                  <button style={styles.smallButton} onClick={() => editOverride(rule)}>Modifier</button>
                  <button style={styles.deleteButton} onClick={() => deleteRule("override", rule.id)}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {defaultPriceModal && (
        <Modal title="Modifier le tarif par défaut" onClose={() => setDefaultPriceModal(null)}>
          <form onSubmit={saveDefaultPrice} style={styles.modalForm}>
            <label style={styles.label}>Tarif par défaut par nuit (€)
              <input style={styles.input} type="number" min="1" step="1" value={defaultPriceModal.nightPrice} onChange={(event) => setDefaultPriceModal({ ...defaultPriceModal, nightPrice: event.target.value })} required />
            </label>
            <label style={styles.label}>Notes internes
              <textarea style={styles.textarea} value={defaultPriceModal.notes} onChange={(event) => setDefaultPriceModal({ ...defaultPriceModal, notes: event.target.value })} />
            </label>
            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setDefaultPriceModal(null)}>Annuler</button>
              <button type="submit" style={styles.primaryButton} disabled={saving}>Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SeasonEditor({ form, setForm, onSubmit, onCancel, saving }) {
  return (
    <form style={styles.formPanel} onSubmit={onSubmit}>
      <div>
        <h3>{form.id ? "Modifier une saison" : "Ajouter une saison"}</h3>
        <p style={styles.muted}>Les dates sont exclusives côté départ : une saison du 19/12 au 03/01 couvre les nuits du 19/12 au 02/01.</p>
      </div>
      <div style={styles.formGrid}>
        <label style={styles.label}>Nom saison<input style={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></label>
        <label style={styles.label}>Date début<input style={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></label>
        <label style={styles.label}>Date fin<input style={styles.input} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></label>
        <label style={styles.label}>Prix/nuit<input style={styles.input} type="number" min="1" step="1" value={form.nightPrice} onChange={(e) => setForm({ ...form, nightPrice: e.target.value })} required /></label>
        <label style={styles.label}>Nuits minimum<input style={styles.input} type="number" min="1" value={form.minimumNights} onChange={(e) => setForm({ ...form, minimumNights: e.target.value })} /></label>
        <label style={styles.label}>Notes<input style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
      <div style={styles.actions}>
        <button style={styles.primaryButton} type="submit" disabled={saving}>{form.id ? "Mettre à jour" : "Créer saison"}</button>
        {form.id && <button style={styles.secondaryButton} type="button" onClick={onCancel}>Annuler édition</button>}
      </div>
    </form>
  );
}

function OverrideEditor({ form, setForm, onSubmit, onCancel, saving }) {
  return (
    <form style={styles.formPanel} onSubmit={onSubmit}>
      <div>
        <h3>{form.id ? "Modifier un tarif spécifique" : "Ajouter un tarif spécifique"}</h3>
        <p style={styles.muted}>Un tarif spécifique est prioritaire sur une saison.</p>
      </div>
      <div style={styles.formGrid}>
        <label style={styles.label}>Nom tarif<input style={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></label>
        <label style={styles.label}>Date début<input style={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></label>
        <label style={styles.label}>Date fin<input style={styles.input} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></label>
        <label style={styles.label}>Prix/nuit<input style={styles.input} type="number" min="1" step="1" value={form.nightPrice} onChange={(e) => setForm({ ...form, nightPrice: e.target.value })} required /></label>
        <label style={styles.label}>Motif<select style={styles.input} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="ajustement">Ajustement</option><option value="promo">Promo</option><option value="vacances">Vacances</option><option value="pont">Pont</option><option value="evenement">Événement</option></select></label>
        <label style={styles.label}>Notes<input style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
      <div style={styles.actions}>
        <button style={styles.primaryButton} type="submit" disabled={saving}>{form.id ? "Mettre à jour" : "Créer tarif spécifique"}</button>
        {form.id && <button style={styles.secondaryButton} type="button" onClick={onCancel}>Annuler édition</button>}
      </div>
    </form>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3>{title}</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display: "grid", gap: "18px" },
  card: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "18px" },
  cardPremium: { background: "linear-gradient(135deg,#ecfdf5,#f8fafc)", border: "1px solid #bbf7d0", borderRadius: "24px", padding: "20px" },
  editorCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: "24px", padding: "18px", boxShadow: "0 12px 30px rgba(15,23,42,0.06)" },
  header: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  kicker: { textTransform: "uppercase", letterSpacing: "0.12em", color: "#0f766e", fontWeight: 800, fontSize: "12px", margin: 0 },
  cardTitle: { marginTop: "4px" },
  muted: { color: "#64748b", fontSize: "14px", margin: "6px 0" },
  info: { color: "#0f766e", fontWeight: 700 },
  error: { color: "#dc2626", fontWeight: 700 },
  notes: { color: "#475569", background: "white", borderRadius: "12px", padding: "8px", fontSize: "13px" },
  bigPrice: { fontSize: "32px", color: "#14532d" },
  rulePrice: { fontSize: "18px", color: "#14532d" },
  switchRow: { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" },
  switchButton: { border: "1px solid #d1d5db", background: "#f8fafc", borderRadius: "999px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  activeSwitch: { border: "1px solid #14532d", background: "#14532d", color: "white", borderRadius: "999px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  formPanel: { display: "grid", gap: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  label: { display: "grid", gap: "7px", fontWeight: 800, color: "#334155", fontSize: "14px" },
  input: { padding: "12px", borderRadius: "12px", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "12px", borderRadius: "12px", border: "1px solid #d1d5db", width: "100%", minHeight: "100px", boxSizing: "border-box" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px", marginTop: "14px" },
  ruleCard: { border: "1px solid #e2e8f0", background: "white", borderRadius: "18px", padding: "14px", display: "grid", gap: "6px" },
  ruleTop: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" },
  badgeBlue: { background: "#dbeafe", color: "#1d4ed8", borderRadius: "999px", padding: "4px 8px", fontSize: "12px", fontWeight: 800 },
  badgeGreen: { background: "#dcfce7", color: "#166534", borderRadius: "999px", padding: "4px 8px", fontSize: "12px", fontWeight: 800 },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" },
  primaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 800 },
  secondaryButton: { border: "1px solid #d1d5db", borderRadius: "999px", padding: "10px 14px", background: "white", color: "#334155", cursor: "pointer", fontWeight: 800 },
  smallButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", fontWeight: 800 },
  deleteButton: { border: "none", borderRadius: "999px", background: "#dc2626", color: "white", padding: "8px 12px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 9999, display: "grid", placeItems: "center", padding: "18px" },
  modalCard: { background: "white", borderRadius: "24px", padding: "20px", maxWidth: "520px", width: "100%", boxShadow: "0 30px 80px rgba(0,0,0,0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" },
  closeButton: { border: "none", background: "#e2e8f0", borderRadius: "999px", width: "36px", height: "36px", cursor: "pointer", fontSize: "22px", lineHeight: 1 },
  modalForm: { display: "grid", gap: "14px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" },
};
