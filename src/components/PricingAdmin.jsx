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

const TAX_CLASSIFICATIONS = [
  ["unclassified", "Non classé"],
  ["1_star", "1 étoile"],
  ["2_star", "2 étoiles"],
  ["3_star", "3 étoiles"],
];

function taxClassificationLabel(value) {
  return TAX_CLASSIFICATIONS.find(([key]) => key === value)?.[1] || value || "-";
}

function taxRuleStatus(rule, today) {
  if (rule.effective_from > today) return "Programmée";
  if (rule.effective_to && rule.effective_to < today) return "Expirée";
  return "En vigueur";
}

function formatTaxRule(rule) {
  if (!rule) return "Aucune règle";
  if (rule.calculation_type === "fixed") return `${formatMoney(Number(rule.fixed_rate_cents || 0) / 100)} / personne taxable / nuit`;
  return `${Number(rule.base_rate_basis_points || 0) / 100} % · plafond ${formatMoney(Number(rule.base_cap_cents || 0) / 100)} + taxes additionnelles`;
}

function proposedTaxFormula(rule) {
  if (!rule) return "";
  if (rule.calculationType === "fixed") {
    const rate = Number(rule.fixedRateEuros);
    const rateLabel = Number.isFinite(rate) ? `${rate.toFixed(2).replace(".", ",")} €` : "tarif fixe";
    return `Taxe totale = ${rateLabel} × adultes taxables × nuits`;
  }
  const baseRate = Number(rule.baseRatePercent);
  const department = Number(rule.departmentAdditionalPercent);
  const regional = Number(rule.regionalAdditionalPercent);
  const cap = Number(rule.baseCapEuros);
  const pct = (value, fallback) => Number.isFinite(value) ? `${value.toFixed(2).replace(".", ",")} %` : fallback;
  const money = Number.isFinite(cap) ? `${cap.toFixed(2).replace(".", ",")} €` : "plafond";
  return [
    `Base / personne / nuit = arrondi au centime((hébergement net de la nuit ÷ voyageurs) × ${pct(baseRate, "taux de base")})`,
    `Base plafonnée = min(Base ; ${money})`,
    `Département = arrondi au centime(Base plafonnée × ${pct(department, "taux départemental")})`,
    `Région = arrondi au centime(Base plafonnée × ${pct(regional, "taux régional")})`,
    "Taxe de la nuit = (Base plafonnée + Département + Région) × adultes taxables",
    "Taxe totale = somme des taxes de chaque nuit",
  ].join("\n");
}

function emptyTaxRule(classification = "unclassified") {
  return {
    classification, effectiveFrom: "",
    calculationType: classification === "unclassified" ? "proportional" : "fixed",
    baseRatePercent: "5", departmentAdditionalPercent: "10", regionalAdditionalPercent: "34",
    baseCapEuros: "4.60", fixedRateEuros: "", notes: "",
    simulation: { nightlyAccommodationEuros: "100", nights: "2", adults: "2", children: "0" },
    simulationResult: null,
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

export default function PricingAdmin({ mode = "all" }) {
  const [defaultNightPrice, setDefaultNightPrice] = useState(null);
  const [cleaningFee, setCleaningFee] = useState(null);
  const [keyboxCode, setKeyboxCode] = useState(null);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState([]);
  const [seasonForm, setSeasonForm] = useState(emptySeason());
  const [overrideForm, setOverrideForm] = useState(emptyOverride());
  const [defaultPriceModal, setDefaultPriceModal] = useState(null);
  const [cleaningFeeModal, setCleaningFeeModal] = useState(null);
  const [keyboxCodeModal, setKeyboxCodeModal] = useState(null);
  const [taxClassification, setTaxClassification] = useState("unclassified");
  const [taxRules, setTaxRules] = useState([]);
  const [taxToday, setTaxToday] = useState(new Date().toISOString().slice(0, 10));
  const [taxClassificationModal, setTaxClassificationModal] = useState(null);
  const [taxRuleModal, setTaxRuleModal] = useState(null);
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
      setCleaningFee(Number(data.cleaningFee ?? 50));

      const keyboxResponse = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "get_keybox_code" }),
      });
      const keyboxData = await keyboxResponse.json();
      if (!keyboxResponse.ok) throw new Error(keyboxData.error || "Erreur chargement boîte à clés");
      setKeyboxCode(String(keyboxData.keyboxCode || ""));

      const taxResponse = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "get_tourist_tax_config" }),
      });
      const taxData = await taxResponse.json();
      if (!taxResponse.ok) throw new Error(taxData.error || "Erreur chargement taxe de séjour");
      setTaxClassification(taxData.classification || "unclassified");
      setTaxRules(taxData.rules || []);
      setTaxToday(taxData.today || new Date().toISOString().slice(0, 10));

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

  function openCleaningFeeModal() {
    setCleaningFeeModal({
      cleaningFee: String(cleaningFee ?? 50),
    });
  }

  async function saveCleaningFee(event) {
    event.preventDefault();

    if (!cleaningFeeModal) return;

    const value = Number(cleaningFeeModal.cleaningFee);
    if (!Number.isInteger(value) || value < 0) return alert("Entre un forfait ménage valide.");

    setSaving(true);

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({
          action: "update_cleaning_fee",
          cleaningFee: value,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      setCleaningFeeModal(null);
      await loadPricing();
    } catch (err) {
      alert("Erreur forfait ménage : " + err.message);
    }

    setSaving(false);
  }

  function openKeyboxCodeModal() {
    setKeyboxCodeModal({ keyboxCode: String(keyboxCode || "") });
  }

  async function saveKeyboxCode(event) {
    event.preventDefault();
    if (!keyboxCodeModal) return;

    const value = String(keyboxCodeModal.keyboxCode || "").trim();
    if (!value || value.length > 32) return alert("Entre un code de boîte à clés valide.");

    setSaving(true);
    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "update_keybox_code", keyboxCode: value }),
      });
      if (!response.ok) throw new Error(await response.text());
      setKeyboxCodeModal(null);
      await loadPricing();
    } catch (err) {
      alert("Erreur boîte à clés : " + err.message);
    }
    setSaving(false);
  }

  async function saveTaxClassification(event) {
    event.preventDefault();
    if (!taxClassificationModal) return;
    setSaving(true);
    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST", headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "update_tourist_tax_classification", classification: taxClassificationModal.classification }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur classement");
      setTaxClassificationModal(null);
      await loadPricing();
    } catch (err) { alert("Erreur classement taxe : " + err.message); }
    setSaving(false);
  }

  function openTaxRuleModal(classification) {
    setTaxRuleModal(emptyTaxRule(classification));
  }

  function updateTaxRuleModal(patch) {
    setTaxRuleModal((current) => current ? { ...current, ...patch, simulationResult: null } : current);
  }

  async function simulateTaxRule() {
    if (!taxRuleModal) return;
    const proportional = taxRuleModal.calculationType === "proportional";
    const toBasisPoints = (value) => Math.round(Number(value) * 100);
    const toCents = (value) => Math.round(Number(value) * 100);
    const response = await fetch("/.netlify/functions/save-price-rule", {
      method: "POST", headers: await getAdminFetchHeaders(),
      body: JSON.stringify({
        action: "simulate_tourist_tax_rule",
        classification: taxRuleModal.classification,
        effectiveFrom: taxRuleModal.effectiveFrom,
        calculationType: taxRuleModal.calculationType,
        baseRateBasisPoints: proportional ? toBasisPoints(taxRuleModal.baseRatePercent) : null,
        departmentAdditionalBasisPoints: proportional ? toBasisPoints(taxRuleModal.departmentAdditionalPercent) : null,
        regionalAdditionalBasisPoints: proportional ? toBasisPoints(taxRuleModal.regionalAdditionalPercent) : null,
        baseCapCents: proportional ? toCents(taxRuleModal.baseCapEuros) : null,
        fixedRateCents: proportional ? null : toCents(taxRuleModal.fixedRateEuros),
        nightlyAccommodationEuros: Number(taxRuleModal.simulation.nightlyAccommodationEuros),
        nights: Number(taxRuleModal.simulation.nights),
        adults: Number(taxRuleModal.simulation.adults),
        children: Number(taxRuleModal.simulation.children),
      }),
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || "Erreur calculateur taxe de séjour");
    setTaxRuleModal((current) => current ? { ...current, simulationResult: data } : current);
  }

  async function saveTaxRule(event) {
    event.preventDefault();
    if (!taxRuleModal) return;
    if (!taxRuleModal.simulationResult) return alert("Exécute au moins un cas test avant de valider la nouvelle règle.");
    const proportional = taxRuleModal.calculationType === "proportional";
    const toBasisPoints = (value) => Math.round(Number(value) * 100);
    const toCents = (value) => Math.round(Number(value) * 100);
    const payload = {
      action: "create_tourist_tax_rule",
      classification: taxRuleModal.classification,
      effectiveFrom: taxRuleModal.effectiveFrom,
      calculationType: taxRuleModal.calculationType,
      baseRateBasisPoints: proportional ? toBasisPoints(taxRuleModal.baseRatePercent) : null,
      departmentAdditionalBasisPoints: proportional ? toBasisPoints(taxRuleModal.departmentAdditionalPercent) : null,
      regionalAdditionalBasisPoints: proportional ? toBasisPoints(taxRuleModal.regionalAdditionalPercent) : null,
      baseCapCents: proportional ? toCents(taxRuleModal.baseCapEuros) : null,
      fixedRateCents: proportional ? null : toCents(taxRuleModal.fixedRateEuros),
      notes: taxRuleModal.notes,
    };
    const numbers = proportional
      ? [payload.baseRateBasisPoints, payload.departmentAdditionalBasisPoints, payload.regionalAdditionalBasisPoints, payload.baseCapCents]
      : [payload.fixedRateCents];
    if (!taxRuleModal.effectiveFrom || numbers.some((value) => !Number.isInteger(value) || value < 0)) return alert("Règle de taxe invalide.");
    setSaving(true);
    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST", headers: await getAdminFetchHeaders(), body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur règle taxe");
      setTaxRuleModal(null);
      await loadPricing();
    } catch (err) { alert("Erreur règle taxe : " + err.message); }
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

  const currentTaxRule = useMemo(() => taxRules
    .filter((rule) => rule.classification === taxClassification && rule.effective_from <= taxToday && (!rule.effective_to || rule.effective_to >= taxToday))
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0] || null, [taxRules, taxClassification, taxToday]);

  return (
    <div style={styles.wrapper}>
      {loading && <p>Chargement des tarifs...</p>}
      {saving && <p style={styles.info}>Enregistrement en cours...</p>}
      {error && <p style={styles.error}>Erreur : {error}</p>}

      {mode !== "tax" && (<>
      <section style={styles.cardPremium}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Base tarifaire</p>
            <h3 style={styles.cardTitle}>Tarif par défaut</h3>
            <p style={styles.muted}>Utilisé hors saison et hors tarif spécifique.</p>
          </div>
          <button style={styles.primaryButton} onClick={openDefaultPriceModal}>Modifier</button>
        </div>
        <strong style={styles.bigPrice}>
          {defaultNightPrice === null
            ? "Chargement..."
            : `${formatMoney(defaultNightPrice)} / nuit`}
        </strong>
        <p style={styles.muted}>Priorité appliquée partout : tarif spécifique → tarif saisonnier → tarif par défaut.</p>
      </section>

      <section style={styles.cardPremium}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Service optionnel</p>
            <h3 style={styles.cardTitle}>Forfait ménage</h3>
            <p style={styles.muted}>Montant proposé au client pour le ménage de fin de séjour.</p>
          </div>
          <button style={styles.primaryButton} onClick={openCleaningFeeModal}>Modifier</button>
        </div>
        <strong style={styles.bigPrice}>
          {cleaningFee === null
            ? "Chargement..."
            : `${formatMoney(cleaningFee)} / séjour`}
        </strong>
      </section>

      <section style={styles.cardPremium}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Accueil voyageurs</p>
            <h3 style={styles.cardTitle}>Boîte à clés</h3>
            <p style={styles.muted}>Code courant communiqué aux voyageurs dans les emails envoyés à J-2.</p>
          </div>
          <button style={styles.primaryButton} onClick={openKeyboxCodeModal}>Modifier</button>
        </div>
        <strong style={styles.bigPrice}>
          {keyboxCode === null ? "Chargement..." : keyboxCode || "Non renseigné"}
        </strong>
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

      </>)}

      {mode !== "pricing" && (<>
      <section style={styles.cardPremium}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>Taxe de séjour</p>
            <h3 style={styles.cardTitle}>Classement et barème réglementaire</h3>
            <p style={styles.muted}>Le classement du logement et les règles tarifaires sont indépendants. Les réservations déjà créées conservent toujours leur snapshot.</p>
          </div>
          <button style={styles.primaryButton} onClick={() => setTaxClassificationModal({ classification: taxClassification })}>Changer le classement</button>
        </div>
        <div style={styles.taxSummary}>
          <div><span style={styles.muted}>Classement utilisé</span><strong style={styles.rulePrice}>{taxClassificationLabel(taxClassification)}</strong></div>
          <div><span style={styles.muted}>Règle en vigueur aujourd’hui</span><strong>{formatTaxRule(currentTaxRule)}</strong>{currentTaxRule && <small style={styles.muted}>Depuis le {formatDate(currentTaxRule.effective_from)} · saisie le {formatDate(currentTaxRule.created_at)}</small>}</div>
        </div>
        <div style={styles.grid}>
          {TAX_CLASSIFICATIONS.map(([classification, label]) => {
            const rules = taxRules.filter((rule) => rule.classification === classification).sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
            return <div key={classification} style={styles.ruleCard}>
              <div style={styles.ruleTop}><strong>{label}</strong>{classification === taxClassification && <span style={styles.badgeGreen}>Classement actuel</span>}</div>
              {rules.length === 0 ? <p style={styles.muted}>Aucune règle enregistrée.</p> : rules.map((rule) => {
                const status = taxRuleStatus(rule, taxToday);
                return <div key={rule.id} style={styles.taxRuleLine}>
                  <div style={styles.ruleTop}><strong>{formatTaxRule(rule)}</strong><span style={status === "En vigueur" ? styles.badgeGreen : styles.badgeBlue}>{status}</span></div>
                  <small style={styles.muted}>Début : {formatDate(rule.effective_from)} · saisie : {formatDate(rule.created_at)}</small>
                  {rule.notes && <small style={styles.muted}>{rule.notes}</small>}
                </div>;
              })}
              <button style={styles.secondaryButton} onClick={() => openTaxRuleModal(classification)}>Nouvelle règle</button>
            </div>;
          })}
        </div>
        <p style={styles.muted}>Une nouvelle règle possède uniquement une date de début. La fin de l’ancienne est déduite automatiquement. Une règle saisie en retard ne modifie jamais les réservations déjà enregistrées ; sa date de saisie est conservée pour le futur rapprochement avec la déclaration Aure-Louron.</p>
      </section>

      </>)}

      {mode !== "tax" && (<>
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

      </>)}

      {mode !== "pricing" && (<>
      {taxClassificationModal && (
        <Modal title="Changer le classement du logement" onClose={() => setTaxClassificationModal(null)}>
          <form onSubmit={saveTaxClassification} style={styles.modalForm}>
            <label style={styles.label}>Classement utilisé pour les nouvelles réservations
              <select style={styles.input} value={taxClassificationModal.classification} onChange={(e) => setTaxClassificationModal({ classification: e.target.value })}>
                {TAX_CLASSIFICATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <p style={styles.muted}>Ce changement n’altère aucune réservation déjà créée et ne modifie aucune règle tarifaire.</p>
            <div style={styles.modalActions}><button type="button" style={styles.secondaryButton} onClick={() => setTaxClassificationModal(null)}>Annuler</button><button type="submit" style={styles.primaryButton} disabled={saving}>Enregistrer</button></div>
          </form>
        </Modal>
      )}
      {taxRuleModal && (
        <Modal title={`Nouvelle règle — ${taxClassificationLabel(taxRuleModal.classification)}`} onClose={() => setTaxRuleModal(null)}>
          <form onSubmit={saveTaxRule} style={styles.modalForm}>
            <label style={styles.label}>Date de début d’application<input style={styles.input} type="date" value={taxRuleModal.effectiveFrom} onChange={(e) => updateTaxRuleModal({ effectiveFrom: e.target.value })} required /></label>
            {taxRuleModal.calculationType === "proportional" ? <>
              <label style={styles.label}>Taux de base (%)<input style={styles.input} type="number" min="0" step="0.01" value={taxRuleModal.baseRatePercent} onChange={(e) => updateTaxRuleModal({ baseRatePercent: e.target.value })} required /></label>
              <label style={styles.label}>Additionnelle départementale (%)<input style={styles.input} type="number" min="0" step="0.01" value={taxRuleModal.departmentAdditionalPercent} onChange={(e) => updateTaxRuleModal({ departmentAdditionalPercent: e.target.value })} required /></label>
              <label style={styles.label}>Additionnelle régionale (%)<input style={styles.input} type="number" min="0" step="0.01" value={taxRuleModal.regionalAdditionalPercent} onChange={(e) => updateTaxRuleModal({ regionalAdditionalPercent: e.target.value })} required /></label>
              <label style={styles.label}>Plafond de base (€)<input style={styles.input} type="number" min="0" step="0.01" value={taxRuleModal.baseCapEuros} onChange={(e) => updateTaxRuleModal({ baseCapEuros: e.target.value })} required /></label>
            </> : <label style={styles.label}>Tarif fixe (€ / personne taxable / nuit)<input style={styles.input} type="number" min="0" step="0.01" value={taxRuleModal.fixedRateEuros} onChange={(e) => updateTaxRuleModal({ fixedRateEuros: e.target.value })} required /></label>}
            <label style={styles.label}>Notes internes<textarea style={styles.textarea} value={taxRuleModal.notes} onChange={(e) => updateTaxRuleModal({ notes: e.target.value })} /></label>
            <div style={styles.taxSimulator}>
              <strong>Calculateur de contrôle</strong>
              <p style={styles.muted}>Teste la règle actuelle et la nouvelle avec exactement le même moteur de taxe que les réservations.</p>
              <div style={styles.formulaPreview}>
                <strong>Formule de la nouvelle règle</strong>
                <p style={styles.formula}>{proposedTaxFormula(taxRuleModal)}</p>
              </div>
              <div style={styles.formGrid}>
                <label style={styles.label}>Hébergement / nuit (€)<input style={styles.input} type="number" min="0" step="0.01" value={taxRuleModal.simulation.nightlyAccommodationEuros} onChange={(e) => updateTaxRuleModal({ simulation: { ...taxRuleModal.simulation, nightlyAccommodationEuros: e.target.value } })} /></label>
                <label style={styles.label}>Nuits<input style={styles.input} type="number" min="1" max="60" value={taxRuleModal.simulation.nights} onChange={(e) => updateTaxRuleModal({ simulation: { ...taxRuleModal.simulation, nights: e.target.value } })} /></label>
                <label style={styles.label}>Adultes taxables<input style={styles.input} type="number" min="1" value={taxRuleModal.simulation.adults} onChange={(e) => updateTaxRuleModal({ simulation: { ...taxRuleModal.simulation, adults: e.target.value } })} /></label>
                <label style={styles.label}>Enfants exonérés<input style={styles.input} type="number" min="0" value={taxRuleModal.simulation.children} onChange={(e) => updateTaxRuleModal({ simulation: { ...taxRuleModal.simulation, children: e.target.value } })} /></label>
              </div>
              <button type="button" style={styles.secondaryButton} onClick={simulateTaxRule}>Calculer et comparer</button>
              {taxRuleModal.simulationResult && <div style={styles.taxComparison}>
                <TaxSimulationResult title="Règle actuelle" result={taxRuleModal.simulationResult.current} />
                <TaxSimulationResult title="Nouvelle règle" result={taxRuleModal.simulationResult.proposed} />
              </div>}
            </div>
            <p style={styles.muted}>Aucune date de fin à saisir : l’ancienne règle expire automatiquement la veille de cette date. Cette création ne change pas le classement du logement et n’écrase jamais l’ancienne règle.</p>
            <div style={styles.modalActions}><button type="button" style={styles.secondaryButton} onClick={() => setTaxRuleModal(null)}>Annuler</button><button type="submit" style={styles.primaryButton} disabled={saving || !taxRuleModal.simulationResult}>Valider et programmer cette nouvelle règle</button></div>
          </form>
        </Modal>
      )}

      </>)}

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

      {cleaningFeeModal && (
        <Modal title="Modifier le forfait ménage" onClose={() => setCleaningFeeModal(null)}>
          <form onSubmit={saveCleaningFee} style={styles.modalForm}>
            <label style={styles.label}>Forfait ménage par séjour (€)
              <input
                style={styles.input}
                type="number"
                min="0"
                step="1"
                value={cleaningFeeModal.cleaningFee}
                onChange={(event) => setCleaningFeeModal({ ...cleaningFeeModal, cleaningFee: event.target.value })}
                required
              />
            </label>
            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setCleaningFeeModal(null)}>Annuler</button>
              <button type="submit" style={styles.primaryButton} disabled={saving}>Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
      {keyboxCodeModal && (
        <Modal title="Modifier le code de la boîte à clés" onClose={() => setKeyboxCodeModal(null)}>
          <form onSubmit={saveKeyboxCode} style={styles.modalForm}>
            <label style={styles.label}>Code actuel
              <input
                style={styles.input}
                type="text"
                maxLength="32"
                value={keyboxCodeModal.keyboxCode}
                onChange={(event) => setKeyboxCodeModal({ ...keyboxCodeModal, keyboxCode: event.target.value })}
                autoComplete="off"
                required
              />
            </label>
            <p style={styles.muted}>Toute modification sera utilisée par les prochains emails J-2 envoyés aux voyageurs.</p>
            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => setKeyboxCodeModal(null)}>Annuler</button>
              <button type="submit" style={styles.primaryButton} disabled={saving}>Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TaxSimulationResult({ title, result }) {
  return <div style={styles.simulationCard}>
    <strong>{title}</strong>
    <div style={styles.bigPrice}>{formatMoney(Number(result.totalTaxCents || 0) / 100)}</div>
    <p style={styles.formula}>{result.formula}</p>
    {result.perNight && <small style={styles.muted}>1re nuit : base {formatMoney(result.perNight.baseTaxCents / 100)} · base plafonnée {formatMoney(result.perNight.cappedBaseTaxCents / 100)} · département {formatMoney(result.perNight.departmentTaxCents / 100)} · région {formatMoney(result.perNight.regionalTaxCents / 100)} · tarif/personne {formatMoney(result.perNight.personNightRateCents / 100)}</small>}
  </div>;
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
  taxSimulator: { display: "grid", gap: "12px", padding: "14px", border: "1px solid #d1fae5", borderRadius: "16px", background: "#f0fdf4" },
  taxComparison: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  simulationCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "12px", display: "grid", gap: "8px" },
  formula: { margin: 0, color: "#334155", fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-line", overflowWrap: "anywhere" },
  formulaPreview: { background: "white", border: "1px solid #bbf7d0", borderRadius: "14px", padding: "12px", display: "grid", gap: "8px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
  label: { display: "grid", gap: "7px", fontWeight: 800, color: "#334155", fontSize: "14px" },
  input: { padding: "12px", borderRadius: "12px", border: "1px solid #d1d5db", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "12px", borderRadius: "12px", border: "1px solid #d1d5db", width: "100%", minHeight: "100px", boxSizing: "border-box" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px", marginTop: "14px" },
  ruleCard: { border: "1px solid #e2e8f0", background: "white", borderRadius: "18px", padding: "14px", display: "grid", gap: "6px" },
  taxSummary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", marginTop: "14px", padding: "14px", background: "white", borderRadius: "18px", border: "1px solid #d1fae5" },
  taxRuleLine: { display: "grid", gap: "4px", padding: "10px 0", borderTop: "1px solid #e2e8f0" },
  ruleTop: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" },
  badgeBlue: { background: "#dbeafe", color: "#1d4ed8", borderRadius: "999px", padding: "4px 8px", fontSize: "12px", fontWeight: 800 },
  badgeGreen: { background: "#dcfce7", color: "#166534", borderRadius: "999px", padding: "4px 8px", fontSize: "12px", fontWeight: 800 },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" },
  primaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 800 },
  secondaryButton: { border: "1px solid #d1d5db", borderRadius: "999px", padding: "10px 14px", background: "white", color: "#334155", cursor: "pointer", fontWeight: 800 },
  smallButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", fontWeight: 800 },
  deleteButton: { border: "none", borderRadius: "999px", background: "#dc2626", color: "white", padding: "8px 12px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 9999, display: "grid", placeItems: "center", padding: "18px", overflowY: "auto" },
  modalCard: { background: "white", borderRadius: "24px", padding: "20px", maxWidth: "520px", width: "100%", maxHeight: "calc(100dvh - 36px)", overflowY: "auto", overscrollBehavior: "contain", boxSizing: "border-box", boxShadow: "0 30px 80px rgba(0,0,0,0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" },
  closeButton: { border: "none", background: "#e2e8f0", borderRadius: "999px", width: "36px", height: "36px", cursor: "pointer", fontSize: "22px", lineHeight: 1 },
  modalForm: { display: "grid", gap: "14px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" },
};
