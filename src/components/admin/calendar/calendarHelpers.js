export const COLORS = {
  airbnb: "#dc2626",
  booking: "#2563eb",
  pending: "#eab308",
  accepted: "#dcfce7",
  deposit_paid: "#22c55e",
  paid: "#22c55e",
  fully_paid: "#14532d",
  confirmed: "#14532d",
  personal: "#6b7280",
  admin_block: "#111827",
  price: "#0f766e",
  external_pending: "#2563eb",
  external_block: "#2563eb",
};

export function getColor(status) {
  const value = String(status || "").toLowerCase();
  if (value === "pending") return COLORS.pending;
  if (["accepted", "deposit_pending", "payment_pending", "awaiting_payment"].includes(value)) return COLORS.accepted;
  if (["deposit_paid", "paid"].includes(value)) return COLORS.deposit_paid;
  if (["fully_paid", "confirmed"].includes(value)) return COLORS.fully_paid;
  return "#6b7280";
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

export function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isBeforeToday(dateStr) {
  const value = parseLocalDate(dateStr);
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  value.setHours(0, 0, 0, 0);
  return value < today;
}

export function selectionStartsBeforeToday(selectionInfo) {
  return isBeforeToday(selectionInfo?.startStr);
}

export function emptySelectionForm(selection = null) {
  return {
    action: "block",
    title: "Blocage admin",
    notes: "",
    clientMessage: "",
    internalNotes: "",
    housekeepingNotes: "",
    customerMode: "existing",
    customerId: "",
    customerSearch: "",
    displayName: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    customerNotes: "",
    customerSource: "",
    marketingConsent: false,
    adults: "",
    children: "",
    babyBedNeeded: false,
    arrivalTime: "",
    total: "0",
    amountPaid: "0",
    sendPaymentLink: true,
    priceLabel: "Tarif spécifique",
    nightPrice: "80",
    priceReason: "ajustement",
    priceNotes: "",
    startDate: selection?.startStr || "",
    endDate: selection?.endStr || "",
  };
}

export function nightsBetween(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) return [];
  const nights = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    nights.push(formatLocalDate(d));
  }
  return nights;
}

export function isDateInSelectedPeriod(key, selectedPeriod) {
  if (!selectedPeriod?.startStr || !selectedPeriod?.endStr) return false;
  return key >= selectedPeriod.startStr && key < selectedPeriod.endStr;
}

export function shouldShowAdminCalendarToolbar(mode = "admin") {
  return mode !== "housekeeping";
}

export function isClosedExternalReservation(reservation = {}) {
  const marker = [reservation.title, reservation.guest_name, reservation.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return marker.includes("closed") || marker.includes("not available") || marker.includes("unavailable");
}

export function getExternalImportStatus(reservation = {}, linkedClient = null) {
  if (reservation.import_status) return reservation.import_status;
  if (linkedClient?.guest_first_name || linkedClient?.guest_last_name || linkedClient?.guest_email || linkedClient?.guest_phone) return "linked";
  return isClosedExternalReservation(reservation) ? "needs_action" : "needs_info";
}

export function getExternalTitle({ reservation, linkedClient, sourceLabel }) {
  const clientName = linkedClient
    ? [linkedClient.guest_first_name, linkedClient.guest_last_name].filter(Boolean).join(" ")
    : "";

  const status = getExternalImportStatus(reservation, linkedClient);
  if (clientName) return `${sourceLabel} - ${clientName}`;
  if (status === "needs_action") return `À renseigner - ${sourceLabel}`;
  if (status === "needs_info") return `${sourceLabel} - Infos à compléter`;
  return sourceLabel;
}

export function buildExternalReservation(props = {}, title = "") {
  const linked = props.linkedClient || {};
  const sourceLabel = props.source === "airbnb" ? "Airbnb" : "Booking";
  const firstName = linked.guest_first_name || "";
  const lastName = linked.guest_last_name || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || title || sourceLabel;

  return {
    id: props.uid || `${props.source || "external"}-${props.start_date || props.start}`,
    uid: props.uid,
    source: props.source,
    sourceLabel,
    status: "confirmed",
    displayName,
    guest_first_name: firstName,
    guest_last_name: lastName,
    guest_email: linked.guest_email || "",
    guest_phone: linked.guest_phone || "",
    start_date: props.start_date || props.start,
    end_date: props.end_date || props.end,
    // Réservé aux vrais messages rédigés par un client.
    // Les infos saisies côté admin pour les imports externes restent dans les notes admin.
    message: props.message || "",
    housekeeping_notes: linked.housekeeping_notes || linked.notes || props.housekeeping_notes || "",
    housekeeping_user_notes: linked.housekeeping_user_notes || props.housekeeping_user_notes || "",
    adults_count: linked.adults_count || props.adults_count || null,
    children_count: linked.children_count || props.children_count || null,
    baby_bed_needed: linked.baby_bed_needed ?? props.baby_bed_needed ?? null,
    arrival_time: linked.arrival_time || props.arrival_time || null,
    customer_id: linked.customer_id || linked.customer?.id || null,
    customerSummary: {
      id: linked.customer_id || linked.customer?.id || null,
      firstName,
      lastName,
      fullName: displayName,
      email: linked.guest_email || "",
      phone: linked.guest_phone || "",
      role: "Client plateforme",
    },
    sourceRecord: props,
    external_import_status: props.import_status || getExternalImportStatus(props, linked),
    is_closed_external_block: props.is_closed_block || isClosedExternalReservation(props),
    is_external_reservation: true,
  };
}

export function contactEmail(email) {
  if (email) window.location.href = `mailto:${email}`;
}

export function contactPhone(phone) {
  if (phone) window.location.href = `tel:${phone}`;
}

export function contactSms(phone) {
  if (phone) window.location.href = `sms:${phone}`;
}
