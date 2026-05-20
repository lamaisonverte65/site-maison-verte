import { useEffect, useState } from "react";
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
  return { id: null, label: "", startDate: "", endDate: "", nightPrice: "", minimumNights: "6", notes: "" };
}

function emptyOverride() {
  return { id: null, label: "", startDate: "", endDate: "", nightPrice: "", reason: "ajustement", notes: "" };
}

export default function PricingAdmin() {
  const [defaultNightPrice, setDefaultNightPrice] = useState(80);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState([]);
  const [seasonForm, setSeasonForm] = useState(emptySeason());
  const [overrideForm, setOverrideForm] = useState(emptyOverride());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadPricing(); }, []);

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

  async function saveDefaultPrice() {
    const value = window.prompt("Tarif par défaut par nuit (€) :", String(defaultNightPrice || 80));
    if (value === null) return;
    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "update_default_price", defaultNightPrice: Number(value), notes: "Tarif par défaut" }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadPricing();
    } catch (err) {
      alert("Erreur tarif par défaut : " + err.message);
    }
  }

  function editSeason(rule) {
    setSeasonForm({
      id: rule?.id || null,
      label: rule?.label || "",
      startDate: rule?.start_date || "",
      endDate: rule?.end_date || "",
      nightPrice: rule?.night_price ?? "",
      minimumNights: rule?.minimum_nights ?? "6",
      notes: rule?.notes || "",
    });
  }

  function editOverride(rule) {
    setOverrideForm({
      id: rule?.id || null,
      label: rule?.label || "",
      startDate: rule?.start_date || "",
      endDate: rule?.end_date || "",
      nightPrice: rule?.night_price ?? "",
      reason: rule?.reason || "ajustement",
      notes: rule?.notes || "",
    });
  }

  async function saveSeason(event) {
    event.preventDefault();
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
  }

  async function saveOverride(event) {
    event.preventDefault();
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
  }

  async function deleteRule(ruleType, id) {
    if (!window.confirm("Supprimer cette règle de prix ?")) return;
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
  }

  return (
    <div style={styles.wrapper}>
      {loading && <p>Chargement des tarifs...</p>}
      {error && <p style={styles.error}>Erreur : {error}</p>}

      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3>Tarif par défaut</h3>
            <p style={styles.muted}>Utilisé hors saison et hors tarif spécifique.</p>
          </div>
          <button style={styles.primaryButton} onClick={saveDefaultPrice}>Modifier</button>
        </div>
        <strong style={styles.bigPrice}>{formatMoney(defaultNightPrice)} / nuit</strong>
      </section>

      <section style={styles.card}>
        <h3>{seasonForm.id ? "Modifier une saison" : "Ajouter une saison"}</h3>
        <form style={styles.formGrid} onSubmit={saveSeason}>
          <input style={styles.input} placeholder="Nom saison" value={seasonForm.label} onChange={(e) => setSeasonForm({ ...seasonForm, label: e.target.value })} required />
          <input style={styles.input} type="date" value={seasonForm.startDate} onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })} required />
          <input style={styles.input} type="date" value={seasonForm.endDate} onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })} required />
          <input style={styles.input} type="number" min="0" step="1" placeholder="Prix/nuit" value={seasonForm.nightPrice} onChange={(e) => setSeasonForm({ ...seasonForm, nightPrice: e.target.value })} required />
          <input style={styles.input} type="number" min="1" placeholder="Nuits minimum" value={seasonForm.minimumNights} onChange={(e) => setSeasonForm({ ...seasonForm, minimumNights: e.target.value })} />
          <input style={styles.input} placeholder="Notes" value={seasonForm.notes} onChange={(e) => setSeasonForm({ ...seasonForm, notes: e.target.value })} />
          <button style={styles.primaryButton} type="submit">Enregistrer saison</button>
          {seasonForm.id && <button style={styles.secondaryButton} type="button" onClick={() => setSeasonForm(emptySeason())}>Annuler édition</button>}
        </form>

        <div style={styles.grid}>
          {seasonPrices.map((rule) => (
            <div key={rule.id} style={styles.ruleCard}>
              <strong>{rule.label}</strong>
              <p style={styles.muted}>{formatDate(rule.start_date)} → {formatDate(rule.end_date)} · {formatMoney(rule.night_price)} / nuit</p>
              {rule.minimum_nights && <p style={styles.muted}>Minimum : {rule.minimum_nights} nuits</p>}
              {rule.notes && <p style={styles.muted}>{rule.notes}</p>}
              <div style={styles.actions}>
                <button style={styles.smallButton} onClick={() => editSeason(rule)}>Modifier</button>
                <button style={styles.deleteButton} onClick={() => deleteRule("season", rule.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h3>Tarifs spécifiques</h3>
        <p style={styles.muted}>Ils sont prioritaires sur les saisons : promo, Noël, pont, événement, ajustement ponctuel.</p>
        <form style={styles.formGrid} onSubmit={saveOverride}>
          <input style={styles.input} placeholder="Nom tarif" value={overrideForm.label} onChange={(e) => setOverrideForm({ ...overrideForm, label: e.target.value })} required />
          <input style={styles.input} type="date" value={overrideForm.startDate} onChange={(e) => setOverrideForm({ ...overrideForm, startDate: e.target.value })} required />
          <input style={styles.input} type="date" value={overrideForm.endDate} onChange={(e) => setOverrideForm({ ...overrideForm, endDate: e.target.value })} required />
          <input style={styles.input} type="number" min="0" step="1" placeholder="Prix/nuit" value={overrideForm.nightPrice} onChange={(e) => setOverrideForm({ ...overrideForm, nightPrice: e.target.value })} required />
          <select style={styles.input} value={overrideForm.reason} onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}>
            <option value="ajustement">Ajustement</option>
            <option value="promo">Promo</option>
            <option value="vacances">Vacances</option>
            <option value="pont">Pont</option>
            <option value="evenement">Événement</option>
          </select>
          <input style={styles.input} placeholder="Notes" value={overrideForm.notes} onChange={(e) => setOverrideForm({ ...overrideForm, notes: e.target.value })} />
          <button style={styles.primaryButton} type="submit">Enregistrer tarif spécifique</button>
          {overrideForm.id && <button style={styles.secondaryButton} type="button" onClick={() => setOverrideForm(emptyOverride())}>Annuler édition</button>}
        </form>

        <div style={styles.grid}>
          {priceOverrides.map((rule) => (
            <div key={rule.id} style={styles.ruleCard}>
              <strong>{rule.label}</strong>
              <p style={styles.muted}>{formatDate(rule.start_date)} → {formatDate(rule.end_date)} · {formatMoney(rule.night_price)} / nuit</p>
              {rule.reason && <p style={styles.muted}>Motif : {rule.reason}</p>}
              {rule.notes && <p style={styles.muted}>{rule.notes}</p>}
              <div style={styles.actions}>
                <button style={styles.smallButton} onClick={() => editOverride(rule)}>Modifier</button>
                <button style={styles.deleteButton} onClick={() => deleteRule("override", rule.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const styles = {
  wrapper: { display: "grid", gap: "18px" },
  card: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "18px" },
  header: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  muted: { color: "#64748b", fontSize: "14px", margin: "6px 0" },
  bigPrice: { fontSize: "28px", color: "#14532d" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", margin: "12px 0 18px" },
  input: { padding: "12px", borderRadius: "12px", border: "1px solid #d1d5db" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  ruleCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "14px" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" },
  primaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#e5e7eb", cursor: "pointer" },
  smallButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#dbeafe", color: "#1d4ed8", cursor: "pointer" },
  deleteButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#dc2626", color: "white", cursor: "pointer" },
  error: { background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "14px" },
};
