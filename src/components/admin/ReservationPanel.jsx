import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { styles } from "./adminStyles";
import { getAmounts } from "../../utils/adminFormatters";
import { toReservationView } from "../../adapters/reservationViewAdapter";
import { useReservationTimeline } from "../../hooks/useReservationTimeline";
import ReservationHeader from "./reservation/ReservationHeader";
import ReservationActionsBlock from "./reservation/ReservationActionsBlock";
import ReservationContactLinks from "./reservation/ReservationContactLinks";
import ReservationSummaryBlock from "./reservation/ReservationSummaryBlock";
import CustomerBlock from "./reservation/CustomerBlock";
import OccupancyBlock from "./reservation/OccupancyBlock";
import StayBlock from "./reservation/StayBlock";
import PaymentBlock from "./reservation/PaymentBlock";
import StripeHistoryBlock from "./reservation/StripeHistoryBlock";
import FinancialActionsBlock from "./reservation/FinancialActionsBlock";
import DocumentsBlock from "./reservation/DocumentsBlock";
import MessagesBlock from "./reservation/MessagesBlock";
import TimelineBlock from "./reservation/TimelineBlock";
import HistoryBlock from "./reservation/HistoryBlock";
import CommunicationActions from "./communication/CommunicationActions";
import PermissionGate from "./common/PermissionGate";
import { ADMIN_PERMISSIONS } from "../../utils/adminPermissions";

const STATUS_OPTIONS = [
  ["pending", "À confirmer"],
  ["accepted", "Acceptée"],
  ["deposit_paid", "Acompte payé"],
  ["paid", "Payée"],
  ["fully_paid", "Séjour soldé"],
  ["confirmed", "Confirmée"],
  ["cancelled", "Annulée"],
  ["refused", "Refusée"],
  ["expired", "Expirée"],
];

const fieldStyle = { display: "grid", gap: "6px" };
const labelStyle = { fontSize: "12px", color: "#64748b", fontWeight: 700 };
const inputStyle = { ...styles.input, width: "100%", boxSizing: "border-box", background: "white" };
const textareaStyle = { ...styles.largeTextarea, width: "100%", minHeight: "110px", boxSizing: "border-box", background: "white" };

function getBookingKind(request = {}) {
  const source = String(request.source || request.contract_version || "").toLowerCase();
  if (source.includes("booking")) return "booking";
  if (source.includes("airbnb")) return "airbnb";
  if (source.includes("personal")) return "personal";
  return "site";
}

function toDate(value) {
  return String(value || "").slice(0, 10);
}

function makeEditForm(request = {}) {
  const bookingKind = getBookingKind(request);
  return {
    bookingKind,
    status: request.status || "pending",
    startDate: toDate(request.start_date),
    endDate: toDate(request.end_date),
    displayName: [request.guest_first_name, request.guest_last_name].filter(Boolean).join(" ") || request.display_name || "",
    customerId: request.customer_id || "",
    firstName: request.guest_first_name || "",
    lastName: request.guest_last_name || "",
    phone: request.guest_phone || "",
    email: request.guest_email || "",
    customerSource: request.customer?.source || (bookingKind === "site" ? "site" : bookingKind),
    customerNotes: request.customer?.notes || request.customer_notes || "",
    marketingConsent: Boolean(request.customer?.marketing_consent),
    adults: request.adults_count ?? "",
    children: request.children_count ?? "",
    babyBedNeeded: Boolean(request.baby_bed_needed),
    arrivalTime: request.arrival_time || "",
    total: String(request.owner_price ?? request.estimated_total ?? request.gross_amount ?? 0),
    clientMessage: request.message || "",
    housekeepingNotes: request.housekeeping_notes  || "",
    internalNotes: request.owner_message || "",
  };
}

function EditableReservationForm({ request, form, onChange, onCancel, onSave, saving, saveMessage }) {
  function update(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  const isPersonal = form.bookingKind === "personal";
  const isSite = form.bookingKind === "site";

  return (
    <section style={{ ...styles.panel, marginBottom: 18, border: "2px solid #0f766e" }}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Modification de la fiche réservation</h3>
          <p style={styles.muted}>Lecture et modification restent au même endroit : modifie les champs, puis clique sur Enregistrer.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.smallButton} onClick={onCancel} disabled={saving}>Annuler</button>
          <button type="button" style={styles.addButton} onClick={onSave} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer les modifications"}</button>
        </div>
      </div>

      {saveMessage && <p style={saveMessage.startsWith("Erreur") ? styles.error : styles.info}>{saveMessage}</p>}

      <div style={{ display: "grid", gap: "18px" }}>
        <div style={styles.detailGrid}>
          <label style={fieldStyle}><span style={labelStyle}>Statut</span>
            <select style={inputStyle} value={form.status} onChange={(event) => update("status", event.target.value)}>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={fieldStyle}><span style={labelStyle}>Type</span>
            <select style={inputStyle} value={form.bookingKind} onChange={(event) => update("bookingKind", event.target.value)}>
              <option value="site">Réservation client / site</option>
              <option value="booking">Réservation Booking</option>
              <option value="airbnb">Réservation Airbnb</option>
              <option value="personal">Réservation personnelle</option>
            </select>
          </label>
          <label style={fieldStyle}><span style={labelStyle}>Arrivée</span><input style={inputStyle} type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Départ</span><input style={inputStyle} type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        </div>

        {isPersonal ? (
          <label style={fieldStyle}><span style={labelStyle}>Nom affiché</span><input style={inputStyle} value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Famille, amis, blocage perso..." /></label>
        ) : (
          <>
            <h4 style={styles.subTitle}>Fiche client liée</h4>
            <div style={styles.detailGrid}>
              <label style={fieldStyle}><span style={labelStyle}>Prénom</span><input style={inputStyle} value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Nom</span><input style={inputStyle} value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Téléphone</span><input style={inputStyle} value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Email</span><input style={inputStyle} type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label style={fieldStyle}><span style={labelStyle}>Source client</span><input style={inputStyle} value={form.customerSource} onChange={(event) => update("customerSource", event.target.value)} /></label>
              <label style={{ ...fieldStyle, alignSelf: "end" }}><span style={labelStyle}>Marketing</span><span><input type="checkbox" checked={Boolean(form.marketingConsent)} onChange={(event) => update("marketingConsent", event.target.checked)} /> Accord nouvelles / offres</span></label>
            </div>
            <label style={fieldStyle}><span style={labelStyle}>Infos utiles fiche client</span><textarea style={textareaStyle} value={form.customerNotes} onChange={(event) => update("customerNotes", event.target.value)} placeholder="Informations permanentes liées au client..." /></label>
          </>
        )}

        <h4 style={styles.subTitle}>Fiche réservation</h4>
        <div style={styles.detailGrid}>
          <label style={fieldStyle}><span style={labelStyle}>Adultes</span><input style={inputStyle} type="number" min="0" value={form.adults} onChange={(event) => update("adults", event.target.value)} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Enfants</span><input style={inputStyle} type="number" min="0" value={form.children} onChange={(event) => update("children", event.target.value)} /></label>
          <label style={fieldStyle}><span style={labelStyle}>Heure d'arrivée</span><input style={inputStyle} value={form.arrivalTime} onChange={(event) => update("arrivalTime", event.target.value)} /></label>
          <label style={{ ...fieldStyle, alignSelf: "end" }}><span style={labelStyle}>Lit bébé</span><span><input type="checkbox" checked={Boolean(form.babyBedNeeded)} onChange={(event) => update("babyBedNeeded", event.target.checked)} /> Lit bébé demandé</span></label>
          {isSite && <label style={fieldStyle}><span style={labelStyle}>Montant séjour (€)</span><input style={inputStyle} value={form.total} onChange={(event) => update("total", event.target.value)} /></label>}
        </div>
        <label style={fieldStyle}><span style={labelStyle}>Message client</span><textarea style={textareaStyle} value={form.clientMessage} onChange={(event) => update("clientMessage", event.target.value)} /></label>
        <label style={fieldStyle}><span style={labelStyle}>Notes admin</span><textarea style={textareaStyle} value={form.housekeepingNotes} onChange={(event) => update("housekeepingNotes", event.target.value)} placeholder="Consignes propriétaire / administration visibles par le ménage, modifiables seulement par l’admin..." /></label>
        <label style={fieldStyle}><span style={labelStyle}>Valeur historique propriétaire — provenance non qualifiée</span><textarea style={textareaStyle} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label>
      </div>
    </section>
  );
}

export default function ReservationPanel({
  request,
  onAccept,
  onRefuse,
  onConfirm,
  onCancel,
  onManualPayment,
  onRefundOnly,
  onEmail,
  onPhone,
  onSms,
  onOpenCustomer,
  onOpenCommunication,
  onEdit,
  onDelete,
  onReservationUpdated,
  payments = [],
  events = [],
  emailLogs = [],
  housekeepingNotes = [],
  permissions,
  mode = "admin",
}) {
  const reservation = toReservationView(request);
  const status = reservation.status || "pending";
  const amounts = reservation.financial?.amounts || getAmounts(reservation);
  const timelineItems = useReservationTimeline({ reservation, payments, events, emailLogs });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(() => makeEditForm(request));
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  useEffect(() => {
    setIsEditing(false);
    setEditForm(makeEditForm(request));
    setEditMessage("");
  }, [request?.id]);

  const isReadOnly = mode === "readonly";

  async function getAdminFetchHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  async function saveReservationEdit() {
    if (!request?.id) return;
    if (!editForm.startDate || !editForm.endDate || editForm.endDate <= editForm.startDate) {
      return alert("La période de réservation est invalide.");
    }
    if (editForm.bookingKind !== "personal" && (!String(editForm.firstName || "").trim() || !String(editForm.lastName || "").trim())) {
      return alert("Le prénom et le nom du client sont obligatoires.");
    }
    if (editForm.bookingKind === "personal" && !String(editForm.displayName || "").trim()) {
      return alert("Le nom affiché est obligatoire pour une réservation personnelle.");
    }

    try {
      setSavingEdit(true);
      setEditMessage("");
      const payload = {
        bookingId: request.id,
        bookingKind: editForm.bookingKind,
        status: editForm.status,
        customerId: editForm.customerId || null,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        displayName: editForm.displayName,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        email: editForm.email,
        customerSource: editForm.customerSource,
        marketingConsent: Boolean(editForm.marketingConsent),
        adults: editForm.adults,
        children: editForm.children,
        babyBedNeeded: Boolean(editForm.babyBedNeeded),
        arrivalTime: editForm.arrivalTime,
        total: Number(String(editForm.total || "0").replace(",", ".")) || 0,
        clientMessage: editForm.clientMessage,
        internalNotes: editForm.internalNotes,
        housekeepingNotes: editForm.housekeepingNotes,
      };

      if (String(editForm.customerNotes || "").trim()) {
        payload.customerNotes = editForm.customerNotes;
      }

      const response = await fetch("/.netlify/functions/update-booking-request", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Erreur enregistrement réservation.");
      setEditMessage("Réservation enregistrée.");
      setIsEditing(false);
      await onReservationUpdated?.();
    } catch (error) {
      setEditMessage("Erreur : " + error.message);
    } finally {
      setSavingEdit(false);
    }
  }


  return (
    <div style={styles.reservationSheet}>
      <ReservationHeader request={reservation} status={status} />

      {isEditing ? (
        <EditableReservationForm
          request={reservation}
          form={editForm}
          onChange={setEditForm}
          onCancel={() => { setIsEditing(false); setEditForm(makeEditForm(request)); setEditMessage(""); }}
          onSave={saveReservationEdit}
          saving={savingEdit}
          saveMessage={editMessage}
        />
      ) : (
        <ReservationSummaryBlock reservation={reservation} status={status} amounts={amounts} />
      )}

      {!isReadOnly && (onEdit || onDelete) && (
        <section style={{ marginTop: "18px", padding: "14px", border: "1px solid #e5e7eb", borderRadius: "16px", background: "#f8fafc" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem", color: "#334155" }}>Gestion de la fiche</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {onEdit && !isEditing && (
              <button type="button" style={styles.primaryButton || styles.actionButton} onClick={() => { onEdit(request); setEditForm(makeEditForm(request)); setIsEditing(true); }}>
                Modifier
              </button>
            )}
            {onDelete && (
              <button type="button" style={styles.deleteButton || { background: "#dc2626", color: "white", border: 0, borderRadius: "999px", padding: "10px 14px", cursor: "pointer" }} onClick={() => onDelete(request)}>
                Supprimer
              </button>
            )}
          </div>
        </section>
      )}

      {!isReadOnly && !isEditing && (
        <section style={{ marginTop: "18px", padding: "14px", border: "1px solid #e5e7eb", borderRadius: "16px", background: "#ffffff" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem", color: "#334155" }}>Statut de la réservation</h3>
          <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.manageReservations}>
            <ReservationActionsBlock
              request={reservation}
              status={status}
              onAccept={onAccept}
              onRefuse={onRefuse}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          </PermissionGate>
        </section>
      )}

      <ReservationContactLinks
        request={reservation}
        onEmail={onEmail}
        onPhone={onPhone}
        onSms={onSms}
      />
      <CustomerBlock
        request={reservation}
        onOpenCustomer={onOpenCustomer}
        mode={mode}
      />
      <OccupancyBlock request={reservation} />
      <StayBlock request={reservation} />
      <PaymentBlock request={reservation} status={status} amounts={amounts} />
      <StripeHistoryBlock request={reservation} payments={payments} />

      {!isReadOnly && !isEditing && (
        <section style={{ marginTop: "18px", padding: "14px", border: "1px solid #e5e7eb", borderRadius: "16px", background: "#ffffff" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem", color: "#334155" }}>Paiements</h3>
          <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.managePayments}>
            <FinancialActionsBlock
              request={reservation}
              amounts={amounts}
              onManualPayment={onManualPayment}
              onRefundOnly={onRefundOnly}
            />
          </PermissionGate>
        </section>
      )}

      <DocumentsBlock request={reservation} />
      <MessagesBlock request={reservation} housekeepingNotes={housekeepingNotes} />

      {!isReadOnly && (
        <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.viewCommunication}>
          <CommunicationActions
            context="reservation"
            target={reservation}
            onOpenCommunication={onOpenCommunication}
            onEmail={() => onEmail?.(reservation.guest_email)}
          />
        </PermissionGate>
      )}

      <TimelineBlock items={timelineItems} />

      <HistoryBlock
        payments={payments}
        events={events}
        emailLogs={emailLogs}
      />
    </div>
  );
}
