import { useEffect, useMemo, useState } from "react";
import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import { getReservationCustomerSummary } from "../../../adapters/reservationViewAdapter";
import { useExternalCustomer } from "../../../hooks/useExternalCustomer";

const EDITABLE_EXTERNAL_FIELDS = [
  { key: "firstName", label: "Prénom", placeholder: "Prénom" },
  { key: "lastName", label: "Nom", placeholder: "Nom" },
  { key: "email", label: "Email", placeholder: "email@exemple.fr", type: "email" },
  { key: "phone", label: "Téléphone", placeholder: "06..." },
  { key: "arrivalTime", label: "Heure d'arrivée", placeholder: "ex : 16h00" },
  { key: "childrenCount", label: "Nombre d'enfants", placeholder: "0", type: "number" },
  { key: "babyBedNeeded", label: "Lit bébé", type: "select" },
];

const fieldStyle = { display: "grid", gap: "6px" };
const helperStyle = { fontSize: "12px", color: "#64748b" };
const inputStyle = { ...styles.input, width: "100%", boxSizing: "border-box", background: "white" };
const textareaStyle = { ...styles.largeTextarea, width: "100%", minHeight: "130px", boxSizing: "border-box", background: "white" };

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeBabyBedValue(value) {
  if (value === true || value === "true" || value === "oui" || value === "yes") return "yes";
  if (value === false || value === "false" || value === "non" || value === "no") return "no";
  return "";
}

function getExternalLinkedData(request = {}, customer = {}) {
  const record = request.sourceRecord || {};
  const linked = record.linkedClient || request.linkedClient || {};

  return {
    uid: request.uid || record.uid || linked.uid || request.id,
    source: request.source || record.source || linked.source || "external",
    startDate: request.start_date || record.start_date || record.start || linked.start_date || null,
    endDate: request.end_date || record.end_date || record.end || linked.end_date || null,
    customerId: request.customer_id || customer.id || linked.customer_id || linked.customer?.id || null,
    firstName: customer.firstName || request.guest_first_name || linked.guest_first_name || "",
    lastName: customer.lastName || request.guest_last_name || linked.guest_last_name || "",
    email: customer.email || request.guest_email || linked.guest_email || "",
    phone: customer.phone || request.guest_phone || linked.guest_phone || "",
    arrivalTime: request.arrival_time || request.stay?.arrivalTime || linked.arrival_time || "",
    childrenCount: request.children_count ?? request.occupancy?.children ?? linked.children_count ?? "",
    babyBedNeeded: request.baby_bed_needed ?? request.occupancy?.babyBedNeeded ?? linked.baby_bed_needed ?? null,
    // Message client = uniquement un texte réellement rédigé par le client.
    // linked.notes correspond à des infos admin saisies pour rattacher une réservation externe.
    notes: request.housekeeping_notes || "",
  };
}

function isExternalReservation(request = {}) {
  return Boolean(
    request.is_external_reservation ||
    request.source === "airbnb" ||
    request.source === "booking" ||
    request.sourceRecord?.type === "external" ||
    request.sourceRecord?.source === "airbnb" ||
    request.sourceRecord?.source === "booking"
  );
}

function ExternalField({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <label style={fieldStyle}>
        <span style={helperStyle}>{field.label}</span>
        <select style={inputStyle} value={normalizeBabyBedValue(value)} onChange={(event) => onChange(field.key, event.target.value)}>
          <option value="">Non renseigné</option>
          <option value="yes">Oui</option>
          <option value="no">Non</option>
        </select>
      </label>
    );
  }

  return (
    <label style={fieldStyle}>
      <span style={helperStyle}>{field.label}</span>
      <input
        style={inputStyle}
        type={field.type || "text"}
        placeholder={field.placeholder || field.label}
        value={value ?? ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </label>
  );
}

export default function CustomerBlock({ request, onOpenCustomer, mode = "admin", }) {
  const customer = useMemo(() => getReservationCustomerSummary(request), [request]);
  const external = isExternalReservation(request);
  const initialExternalData = useMemo(() => getExternalLinkedData(request, customer), [request, customer]);
  const externalDataKey = useMemo(() => ([
    initialExternalData.uid,
    initialExternalData.source,
    initialExternalData.startDate,
    initialExternalData.endDate,
    initialExternalData.customerId,
    initialExternalData.firstName,
    initialExternalData.lastName,
    initialExternalData.email,
    initialExternalData.phone,
    initialExternalData.arrivalTime,
    initialExternalData.childrenCount,
    normalizeBabyBedValue(initialExternalData.babyBedNeeded),
    initialExternalData.notes,
  ].map((value) => String(value ?? "")).join("||")), [initialExternalData]);
  const [form, setForm] = useState({
    ...initialExternalData,
    babyBedNeeded: normalizeBabyBedValue(initialExternalData.babyBedNeeded),
  });
  const { saving, statusMessage, saveExternalCustomer, clearStatusMessage } = useExternalCustomer();

  useEffect(() => {
    setForm({
      ...initialExternalData,
      babyBedNeeded: normalizeBabyBedValue(initialExternalData.babyBedNeeded),
    });
    clearStatusMessage();
  }, [externalDataKey]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    clearStatusMessage();
  }

  async function handleExternalCustomerSubmit(event) {
    event.preventDefault();
    clearStatusMessage();

    try {
      await saveExternalCustomer({ initialExternalData, form });
    } catch {
      // Le hook affiche le message d'erreur.
    }
  }

  if (!external) {
    return (
      <>
        <h3 style={styles.subTitle}>Client</h3>
        <div style={styles.detailGrid}>
          <Info label="Prénom" value={customer.firstName || "-"} />
          <Info label="Nom" value={customer.lastName || "-"} />
          <Info label="Rôle" value={customer.role || "Réservataire principal"} />
          <Info label="Email" value={customer.email || "-"} />
          <Info label="Téléphone" value={customer.phone || "-"} />
        </div>
        {mode !== "housekeeping" && onOpenCustomer && (
          <div style={{ ...styles.contactButtons, marginTop: "10px" }}>
            <button style={styles.smallButton} onClick={() => onOpenCustomer(request)}>
              Ouvrir la fiche client
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section style={styles.card}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Client plateforme</h3>
          <p style={styles.muted}>Tous les champs ci-dessous sont directement modifiables. Clique dans le champ, modifie, puis enregistre.</p>
        </div>
        {mode !== "housekeeping" &&
          onOpenCustomer &&
          initialExternalData.customerId && (
          <button style={styles.smallButton} onClick={() => onOpenCustomer(request)}>
            Ouvrir la fiche client complète
          </button>
        )}
      </div>

      <form onSubmit={handleExternalCustomerSubmit} style={{ display: "grid", gap: "14px" }}>
        <div style={styles.detailGrid}>
          {EDITABLE_EXTERNAL_FIELDS.map((field) => (
            <ExternalField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={updateField}
            />
          ))}
        </div>

        <label style={fieldStyle}>
          <span style={helperStyle}>Notes admin plateforme</span>
          <textarea
            style={textareaStyle}
            value={form.notes || ""}
            placeholder="Infos admin utiles pour cette réservation externe : couple, arrivée, consignes, détails plateforme..."
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </label>


        {statusMessage && (
          <p style={statusMessage.startsWith("Erreur") ? styles.error : styles.info}>{statusMessage}</p>
        )}

        <div style={styles.contactButtons}>
          <button style={styles.addButton} type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer les informations client"}
          </button>
        </div>
      </form>
    </section>
  );
}
