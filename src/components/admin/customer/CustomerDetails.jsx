import { useEffect, useMemo, useState } from "react";
import { styles } from "../adminStyles";
import CustomerIdentityBlock from "./CustomerIdentityBlock";
import CustomerContactBlock from "./CustomerContactBlock";
import CustomerLoyaltyBlock from "./CustomerLoyaltyBlock";
import CustomerNotesBlock from "./CustomerNotesBlock";
import CustomerReservationsBlock from "./CustomerReservationsBlock";
import CustomerStatisticsBlock from "./CustomerStatisticsBlock";
import CustomerCommunicationBlock from "./CustomerCommunicationBlock";
import CustomerDocumentsBlock from "./CustomerDocumentsBlock";
import CustomerActionsBlock from "./CustomerActionsBlock";
import CommunicationActions from "../communication/CommunicationActions";
import PermissionGate from "../common/PermissionGate";
import { ADMIN_PERMISSIONS } from "../../../utils/adminPermissions";
import { useCustomerProfile } from "../../../hooks/useCustomerProfile";

function normalizeForm(customer) {
  return {
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    source: customer?.source || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
    postal_code: customer?.postal_code || "",
    city: customer?.city || "",
    country: customer?.country || "",
    booking_count: customer?.booking_count ?? "",
    first_stay: customer?.first_stay || "",
    last_stay: customer?.last_stay || "",
    total_spent: customer?.total_spent ?? "",
    owner_net_total: customer?.owner_net_total ?? "",
    loyalty_discount_percent: customer?.loyalty_discount_percent ?? "",
    marketing_consent: Boolean(customer?.marketing_consent),
    notes: customer?.notes || "",
    housekeeping_notes: customer?.housekeeping_notes || "",
  };
}

function cleanText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function cleanNumber(value, fieldLabel) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  if (Number.isNaN(parsed)) throw new Error(`${fieldLabel} doit être un nombre valide.`);
  return parsed;
}

function cleanInteger(value, fieldLabel) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) throw new Error(`${fieldLabel} doit être un nombre entier positif.`);
  return parsed;
}

function cleanDate(value) {
  return value ? value : null;
}

export default function CustomerDetails({
  customer,
  reservations,
  customerActions,
  contactActions,
  onClose,
  onOpenCommunication,
  permissions,
}) {
  const profile = useCustomerProfile({ customer, reservations });
  const displayName = profile.displayName;
  const [form, setForm] = useState(() => normalizeForm(customer));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    setForm(normalizeForm(customer));
    setSaveMessage("");
  }, [customer?.id]);

  const hasChanges = useMemo(() => {
    const initial = normalizeForm(customer);
    return Object.keys(initial).some((key) => form[key] !== initial[key]);
  }, [customer, form]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveMessage("");
  }

  async function saveCustomer() {
    if (!customer?.id || !customerActions.update) return;

    try {
      setIsSaving(true);
      setSaveMessage("");

      const initial = normalizeForm(customer);
      const cleanedForm = {
        first_name: cleanText(form.first_name),
        last_name: cleanText(form.last_name),
        source: cleanText(form.source),
        phone: cleanText(form.phone),
        email: cleanText(form.email),
        address: cleanText(form.address),
        postal_code: cleanText(form.postal_code),
        city: cleanText(form.city),
        country: cleanText(form.country),
        booking_count: cleanInteger(form.booking_count, "Le nombre de séjours"),
        first_stay: cleanDate(form.first_stay),
        last_stay: cleanDate(form.last_stay),
        total_spent: cleanNumber(form.total_spent, "Le total dépensé"),
        owner_net_total: cleanNumber(form.owner_net_total, "Le net propriétaire"),
        loyalty_discount_percent: cleanNumber(form.loyalty_discount_percent, "La remise fidélité"),
        marketing_consent: Boolean(form.marketing_consent),
        notes: cleanText(form.notes),
        housekeeping_notes: cleanText(form.housekeeping_notes),
      };

      const updates = {};
      Object.keys(cleanedForm).forEach((key) => {
        if (form[key] !== initial[key]) updates[key] = cleanedForm[key];
      });

      if (Object.keys(updates).length === 0) {
        setSaveMessage("Aucune modification à enregistrer.");
        return;
      }

      await customerActions.update(customer.id, updates);
      setSaveMessage("Fiche client enregistrée.");
    } catch (error) {
      alert("Erreur : " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section style={{ ...styles.reservationSheet, marginBottom: "24px" }}>
      <div style={styles.detailHeader}>
        <div>
          <p style={styles.kicker}>Fiche client</p>
          <h3 style={styles.detailTitle}>{displayName}</h3>
          <p style={styles.muted}>Clique dans un champ pour le modifier, puis enregistre la fiche.</p>
        </div>
        <div style={styles.headerActions}>
          {saveMessage && <span style={{ ...styles.muted, alignSelf: "center", color: "#15803d", fontWeight: 700 }}>{saveMessage}</span>}
          <button style={styles.addButton} onClick={saveCustomer} disabled={isSaving || !hasChanges}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button style={styles.smallButton} onClick={onClose}>Fermer la fiche</button>
        </div>
      </div>

      <CustomerActionsBlock
        customer={customer}
        profile={profile}
        contactActions={contactActions}
        customerActions={customerActions}
        onOpenCommunication={onOpenCommunication}
        permissions={permissions}
      />

      <div style={styles.summaryGrid}>
        <CustomerIdentityBlock customer={customer} form={form} onChange={updateForm} />
        <CustomerContactBlock customer={customer} form={form} onChange={updateForm} contactActions={contactActions} />
        <CustomerLoyaltyBlock customer={customer} reservations={reservations} form={form} onChange={updateForm} />
        <CustomerStatisticsBlock profile={profile} />
        <CustomerNotesBlock customer={customer} form={form} onChange={updateForm} />
        <CustomerDocumentsBlock customer={customer} reservations={reservations} />
      </div>

      <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.viewCommunication}>
        <CommunicationActions
          context="customer"
          target={customer}
          onOpenCommunication={onOpenCommunication}
          onEmail={() => contactActions.email(customer.email)}
        />
      </PermissionGate>

      <CustomerCommunicationBlock profile={profile} onOpenCommunication={onOpenCommunication} />
      <CustomerReservationsBlock reservations={reservations} customerActions={customerActions} />
    </section>
  );
}
