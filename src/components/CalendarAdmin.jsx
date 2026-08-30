import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "../supabaseClient";
import CalendarToolbar from "./calendar/CalendarToolbar";
import CalendarLegend from "./calendar/CalendarLegend";
import CalendarHomePanel from "./admin/calendar/CalendarHomePanel";
import EventPanel from "./admin/calendar/EventPanel";
import SelectionPanel from "./admin/calendar/SelectionPanel";
import ReservationSummaryPanel from "./admin/calendar/ReservationSummaryPanel";
import HousekeepingReservationView from "./admin/reservation/HousekeepingReservationView";
import { calendarCss, styles } from "./admin/calendar/calendarStyles";
import {
  buildExternalReservation,
  contactEmail,
  contactPhone,
  contactSms,
  emptySelectionForm,
  formatDate,
  formatLocalDate,
  formatMoney,
  getExternalImportStatus,
  getExternalTitle,
  isBeforeToday,
  isClosedExternalReservation,
  isDateInSelectedPeriod,
  nightsBetween,
  parseLocalDate,
  selectionStartsBeforeToday,
} from "./admin/calendar/calendarHelpers";

const COLORS = {
  airbnb: "#dc2626",          // Airbnb : rouge
  booking: "#2563eb",         // Booking : bleu
  pending: "#eab308",         // Demande en attente : jaune
  accepted: "#dcfce7",        // Acceptée, attente paiement : vert très pâle
  deposit_paid: "#22c55e",    // Acompte payé : vert clair / normal
  fully_paid: "#14532d",      // Solde payé / confirmé : vert foncé
  confirmed: "#14532d",
  personal: "#6b7280",        // Réservation personnelle : gris
  admin_block: "#111827",     // Dates bloquées : noir
  price: "#0f766e",
};

function getColor(status) {
  const value = String(status || "").toLowerCase();
  if (value === "pending") return COLORS.pending;
  if (["accepted", "deposit_pending", "payment_pending", "awaiting_payment"].includes(value)) return COLORS.accepted;
  if (["deposit_paid", "paid"].includes(value)) return COLORS.deposit_paid;
  if (["fully_paid", "confirmed"].includes(value)) return COLORS.fully_paid;
  return "#6b7280";
}

function addOneDayDate(dateStr) {
  const date = parseLocalDate(String(dateStr || "").slice(0, 10));
  if (!date) return dateStr;
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

function isVisualHalfDayEvent(event) {
  const type = event?.extendedProps?.type;
  return ["external", "booking_request", "admin_block"].includes(type);
}

function getSourceStart(event) {
  const props = event?.extendedProps || {};
  if (props.type === "booking_request") return props.reservation?.start_date || event.start;
  if (props.type === "admin_block") return props.block?.start_date || event.start;
  return props.start_date || event.start;
}

function getSourceEnd(event) {
  const props = event?.extendedProps || {};
  if (props.type === "booking_request") return props.reservation?.end_date || event.end;
  if (props.type === "admin_block") return props.block?.end_date || event.end;
  return props.end_date || event.end;
}

function updateHalfDayEdge(info) {
  if (!isVisualHalfDayEvent(info?.event) || !info?.el) return;

  const calendarRoot = info.el.closest(".calendar-admin-calendar");
  const dayCell = calendarRoot?.querySelector(".fc-daygrid-day");
  const dayWidth = dayCell?.getBoundingClientRect?.().width || 0;

  if (!dayWidth) return;
  info.el.style.setProperty("--reservation-edge", `${dayWidth / 2}px`);
}

export default function CalendarAdmin({
  mode = "admin",
  onSelectReservation,
  onCalendarUpdated,
  reservationToEdit,
  onReservationEditHandled,
  housekeepingReservations = [],
  onHousekeepingNoteCreate,
}) {
  const [events, setEvents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState([]);
  const [defaultNightPrice, setDefaultNightPrice] = useState(null);
  const [pricingVersion, setPricingVersion] = useState(0);
  const [calendarRenderKey, setCalendarRenderKey] = useState(0);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState(null);
  const [selectedCalendarReservation, setSelectedCalendarReservation] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [editingReservation, setEditingReservation] = useState(null);
  const [pendingRangeStart, setPendingRangeStart] = useState(null);
  const [selectionForm, setSelectionForm] = useState(emptySelectionForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "housekeeping") return;
    loadCalendar();
    loadCustomers();
  }, [mode]);

  useEffect(() => {
    if (mode !== "housekeeping") return;
    const safeEvents = housekeepingReservations.map((reservation) => {
      const firstName = reservation.guest?.firstName || "";
      const lastName = reservation.guest?.lastName || "";
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Séjour";
      const calendarReservation = {
        ...reservation,
        start_date: reservation.startDate,
        end_date: reservation.endDate,
        displayName,
      };
      return {
        id: reservation.id,
        title: displayName,
        start: reservation.startDate,
        end: reservation.endDate,
        backgroundColor: "#0f766e",
        borderColor: "#0f766e",
        extendedProps: { type: "booking_request", reservation: calendarReservation },
      };
    });
    setEvents(safeEvents);
    setSelectedCalendarReservation((current) => {
      if (!current?.id) return current;
      return safeEvents.find((event) => event.id === current.id)?.extendedProps?.reservation || current;
    });
    setBlocks([]);
    setCalendarRenderKey((previous) => previous + 1);
  }, [mode, housekeepingReservations]);

  useEffect(() => {
    const reservation = reservationToEdit?.request || reservationToEdit;
    if (!reservation?.id) return;
    openReservationEdition(reservation);
    onReservationEditHandled?.();
  }, [reservationToEdit?.key, reservationToEdit?.request?.id, reservationToEdit?.id]);

  async function getAdminFetchHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  async function loadCustomers() {
    if (mode === "housekeeping") return;
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("last_name", { ascending: true });

    if (error) {
      console.error("Erreur chargement clients :", error.message);
      return;
    }

    setCustomers(data || []);
  }


  async function loadPricing() {
    // L'admin utilise la même source fiable que le calendrier public : la fonction Netlify get-pricing.
    // Cela évite les problèmes de RLS en local et supprime le retour au prix codé en dur.
    const response = await fetch("/.netlify/functions/get-pricing");

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    const defaultPrice = Number(data.defaultNightPrice ?? 80);
    const seasons = data.seasonPrices || [];
    const overrides = data.priceOverrides || [];

    setDefaultNightPrice(defaultPrice);
    setSeasonPrices(seasons);
    setPriceOverrides(overrides);
    setPricingVersion((previous) => previous + 1);

    return {
      seasons,
      overrides,
      defaultNightPrice: defaultPrice,
    };
  }

  async function loadCalendar() {
    if (mode === "housekeeping") {
      await onCalendarUpdated?.();
      return;
    }
    setLoading(true);

    try {
      const calendarResponse = await fetch("/.netlify/functions/calendar");
      const calendarData = await calendarResponse.json();

      const pricing = await loadPricing();

      const { data: externalClientLinks } = await supabase
        .from("external_reservation_clients")
        .select("*");

      // Couche source brute : on affiche toujours les ICS Booking/Airbnb tels que renvoyés par calendar.js.
      // Les créations manuelles depuis un import sont affichées ensuite via booking_requests, en parallèle.
      const externalEvents = (calendarData.externalReservations || []).map((reservation) => {
        const linkedClient = (externalClientLinks || []).find((item) => item.uid === reservation.uid);
        const sourceLabel = reservation.source === "airbnb" ? "Airbnb" : "Booking";
        const importStatus = getExternalImportStatus(reservation, linkedClient);
        const isClosedBlock = isClosedExternalReservation(reservation);
        const color = reservation.source === "airbnb" ? COLORS.airbnb : COLORS.booking;

        return {
          id: reservation.uid,
          title: getExternalTitle({ reservation, linkedClient, sourceLabel }),
          start: reservation.start_date,
          end: reservation.end_date,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            type: "external",
            source: reservation.source,
            uid: reservation.uid,
            title: reservation.title,
            guest_name: reservation.guest_name,
            start_date: reservation.start_date,
            end_date: reservation.end_date,
            linkedClient,
            import_status: importStatus,
            is_closed_block: isClosedBlock,
          },
        };
      });

      const { data: requests } = await supabase
        .from("booking_requests")
        .select("*")
        .order("start_date", { ascending: true });

      const directEvents = (requests || [])
        .filter((reservation) => !["refused", "expired", "cancelled"].includes(reservation.status))
        .map((reservation) => {
          const status = reservation.status || "pending";
          const isAdminPersonal = reservation.source === "admin_personal" || reservation.contract_version === "admin_personal";
          const isAdminClient = reservation.source === "admin_client";
          const color = isAdminPersonal ? COLORS.personal : getColor(status);
          const price = reservation.owner_price || reservation.estimated_total;
          const prefix = isAdminPersonal ? "Perso" : isAdminClient ? "Admin" : status === "pending" ? "Demande" : "Direct";
          const name = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ") || "Client";
          return {
            id: reservation.id,
            title: `${prefix} - ${name}${price ? ` · ${formatMoney(price)}` : ""}`,
            start: reservation.start_date,
            end: reservation.end_date,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              type: "booking_request",
              reservation,
            },
          };
        });

      const { data: calendarBlocks } = await supabase
        .from("calendar_blocks")
        .select("*")
        .order("start_date", { ascending: true });

      setBlocks(calendarBlocks || []);

      const blockEvents = (calendarBlocks || []).map((block) => ({
        id: block.id,
        title: block.title || "Blocage admin",
        start: block.start_date,
        end: block.end_date,
        backgroundColor: COLORS.admin_block,
        borderColor: COLORS.admin_block,
        extendedProps: { type: "admin_block", block },
      }));

      setEvents([...externalEvents, ...directEvents, ...blockEvents]);
      setCalendarRenderKey((previous) => previous + 1);
    } catch (error) {
      alert("Erreur calendrier : " + error.message);
    }

    setLoading(false);
  }

  function getPriceForDate(key) {
    const cleanKey = String(key || "").slice(0, 10);

    const override = priceOverridePeriods.find(
      (item) => cleanKey >= item.start && cleanKey < item.end
    );

    if (override) return override.price;

    const season = seasonPeriods.find(
      (item) => cleanKey >= item.start && cleanKey < item.end
    );

    if (season) return season.price;

    return defaultNightPrice === null ? null : Number(defaultNightPrice);
  }

  function computeTotal(startDate, endDate) {
    return nightsBetween(startDate, endDate).reduce((sum, key) => sum + getPriceForDate(key), 0);
  }

  function openEvent(info) {
    const props = info.event.extendedProps;

    if (props.type === "selected_period") {
      return;
    }

    if (props.type === "booking_request") {
      setSelectedExternalEvent(null);
      setSelectedPeriod(null);
      setEditingReservation(null);
      setSelectedCalendarReservation(props.reservation);
      return;
    }

    if (props.type === "external") {
      const externalEvent = { title: info.event.title, start: info.event.startStr, end: info.event.endStr, ...props };
      const reservation = buildExternalReservation(externalEvent, info.event.title);
      setSelectedPeriod(null);

      if (mode === "housekeeping") {
        setSelectedExternalEvent(null);
        setSelectedCalendarReservation(reservation);
        return;
      }

      if (props.import_status === "needs_action" || props.import_status === "needs_info" || props.is_closed_block) {
        setSelectedCalendarReservation(null);
        setSelectedExternalEvent({
            ...externalEvent,
            reservation,
            type: "external_import",
        });
        return;
      }

      setSelectedExternalEvent(null);
      onSelectReservation?.(reservation);
      return;
    }

    if (props.type === "admin_block") {
      if (mode === "housekeeping") return;
      setSelectedCalendarReservation(null);
      setSelectedPeriod(null);
      setSelectedExternalEvent({ title: info.event.title, start: info.event.startStr, end: info.event.endStr, ...props });
    }
  }

  function buildSelectionFromDates(startStr, endStr) {
    return {
      startStr,
      endStr,
      start: parseLocalDate(startStr),
      end: parseLocalDate(endStr),
      allDay: true,
    };
  }

  function getActionFromReservation(reservation = {}) {
    const source = String(reservation.source || reservation.contract_version || "").toLowerCase();
    if (source.includes("booking")) return "booking";
    if (source.includes("airbnb")) return "airbnb";
    if (source.includes("personal")) return "personal";
    return "site";
  }

  function clearEditionAndSelection() {
    setEditingReservation(null);
    setPendingRangeStart(null);
    setSelectedPeriod(null);
    setSelectedExternalEvent(null);
    setSelectedCalendarReservation(null);
    setSelectionForm(emptySelectionForm());
  }

  function openReservationEdition(reservation) {
    if (!reservation?.id) return;
    const startStr = String(reservation.start_date || "").slice(0, 10);
    const endStr = String(reservation.end_date || "").slice(0, 10);
    if (!startStr || !endStr) return alert("Dates de réservation invalides.");

    const action = getActionFromReservation(reservation);
    const editSelection = buildSelectionFromDates(startStr, endStr);
    const total = Number(reservation.owner_price ?? reservation.estimated_total ?? reservation.gross_amount ?? 0) || 0;

    setSelectedExternalEvent(null);
    setSelectedCalendarReservation(null);
    setPendingRangeStart(null);
    setEditingReservation(reservation);
    setSelectedPeriod(editSelection);
    setSelectionForm({
      ...emptySelectionForm(editSelection),
      mode: "edit",
      bookingId: reservation.id,
      action,
      title: reservation.title || "Blocage admin",
      displayName: [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ") || reservation.display_name || "",
      customerId: reservation.customer_id || "",
      customerSearch: [reservation.guest_last_name, reservation.guest_first_name].filter(Boolean).join(" "),
      firstName: reservation.guest_first_name || "",
      lastName: reservation.guest_last_name || "",
      phone: reservation.guest_phone || "",
      email: reservation.guest_email || "",
      customerNotes: reservation.customer_notes || reservation.customer?.notes || "",
      customerSource: reservation.customer?.source || (action === "site" ? "site" : action),
      marketingConsent: Boolean(reservation.customer?.marketing_consent),
      adults: reservation.adults_count ?? "",
      children: reservation.children_count ?? "",
      babyBedNeeded: Boolean(reservation.baby_bed_needed),
      arrivalTime: reservation.arrival_time || "",
      total: action === "site" ? String(total || 0) : "0",
      amountPaid: String(reservation.amount_paid || 0),
      sendPaymentLink: false,
      clientMessage: reservation.message || "",
      internalNotes: reservation.owner_message || "",
      housekeepingNotes: reservation.housekeeping_notes || "",
      notes: "",
      nightPrice: String(getPriceForDate(startStr)),
    });
  }

  async function deleteReservation(reservation) {
    if (!reservation?.id) return;
    const label = [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ") || "cette réservation";
    if (!window.confirm(`Supprimer ${label} ?`)) return;

    try {
      const response = await fetch("/.netlify/functions/delete-booking-request", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ bookingId: reservation.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Erreur suppression réservation.");
      alert("Réservation supprimée.");
      clearEditionAndSelection();
      await loadCalendar();
      onCalendarUpdated?.();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  function openSelectedPeriod(selectionInfo) {
    const computedTotal = computeTotal(selectionInfo.startStr, selectionInfo.endStr);
    setSelectedExternalEvent(null);
    setSelectedCalendarReservation(null);
    setEditingReservation(null);
    setSelectedPeriod(selectionInfo);
    setSelectionForm({
      ...emptySelectionForm(selectionInfo),
      total: String(computedTotal || 0),
      nightPrice: String(getPriceForDate(selectionInfo.startStr)),
    });
  }

  function handleDateSelect(selectionInfo) {
    if (mode === "housekeeping") return;
    if (selectionStartsBeforeToday(selectionInfo)) {
      setPendingRangeStart(null);
      setSelectedPeriod(null);
      return;
    }
    openSelectedPeriod(selectionInfo);
  }

  function handleDateClick(info) {
    if (mode === "housekeeping") return;
    if (isBeforeToday(info.dateStr)) {
      setPendingRangeStart(null);
      setSelectedPeriod(null);
      return;
    }
    const clickedDate = parseLocalDate(info.dateStr);
    if (!clickedDate) return;

    setSelectedExternalEvent(null);
    setEditingReservation(null);

    if (!pendingRangeStart) {
      setSelectedPeriod(null);
      setPendingRangeStart(info.dateStr);
      setSelectionForm(emptySelectionForm({ startStr: info.dateStr, endStr: "" }));
      return;
    }

    if (info.dateStr === pendingRangeStart) {
      const nextDay = new Date(clickedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setPendingRangeStart(null);
      openSelectedPeriod(buildSelectionFromDates(pendingRangeStart, formatLocalDate(nextDay)));
      return;
    }

    const start = pendingRangeStart < info.dateStr ? pendingRangeStart : info.dateStr;
    const end = pendingRangeStart < info.dateStr ? info.dateStr : pendingRangeStart;

    setPendingRangeStart(null);
    openSelectedPeriod(buildSelectionFromDates(start, end));
  }

  async function saveSelectionAction(event) {
    event.preventDefault();

    if (!selectedPeriod) return;

    const effectiveStartDate = String(selectionForm.startDate || selectedPeriod.startStr || "").slice(0, 10);
    const effectiveEndDate = String(selectionForm.endDate || selectedPeriod.endStr || "").slice(0, 10);

    if (!effectiveStartDate || !effectiveEndDate || effectiveEndDate <= effectiveStartDate) {
      return alert("La période de réservation est invalide.");
    }

    try {
      if (selectionForm.action === "block") {
        const { error } = await supabase.from("calendar_blocks").insert([
          {
            title: selectionForm.title || "Blocage admin",
            start_date: effectiveStartDate,
            end_date: effectiveEndDate,
            notes: selectionForm.notes || null,
            source: "admin",
            status: "blocked",
          },
        ]);

        if (error) throw error;
        alert("Dates bloquées.");
      }

      if (["personal", "site", "booking", "airbnb"].includes(selectionForm.action)) {
        const total = selectionForm.action === "site"
          ? Number(String(selectionForm.total || "0").replace(",", "."))
          : 0;

        if (selectionForm.action === "personal" && !selectionForm.displayName.trim()) {
          return alert("Le nom affiché est obligatoire pour garder une information claire dans le calendrier.");
        }

        if (["site", "booking", "airbnb"].includes(selectionForm.action)) {
          if (!selectionForm.firstName.trim() || !selectionForm.lastName.trim()) {
            return alert("Le prénom et le nom du client sont obligatoires.");
          }
        }

        if (selectionForm.action === "site" && total > 0 && selectionForm.sendPaymentLink && !selectionForm.email.trim()) {
          return alert("Un email est obligatoire pour envoyer un lien de paiement Stripe.");
        }

        const payload = {
          bookingKind: selectionForm.action,
          customerId: selectionForm.customerId || null,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          displayName: selectionForm.displayName,
          firstName: selectionForm.firstName,
          lastName: selectionForm.lastName,
          phone: selectionForm.phone,
          email: selectionForm.email,
          customerSource: selectionForm.customerSource,
          marketingConsent: Boolean(selectionForm.marketingConsent),
          adults: selectionForm.adults,
          children: selectionForm.children,
          babyBedNeeded: Boolean(selectionForm.babyBedNeeded),
          arrivalTime: selectionForm.arrivalTime,
          total,
          amountPaid: 0,
          sendPaymentLink: selectionForm.action === "site" && !editingReservation ? Boolean(selectionForm.sendPaymentLink) : false,
          clientMessage: selectionForm.clientMessage,
          internalNotes: selectionForm.internalNotes,
          housekeepingNotes: selectionForm.housekeepingNotes,
        };

        if (String(selectionForm.customerNotes || "").trim()) {
          payload.customerNotes = selectionForm.customerNotes;
        }

        if (editingReservation?.id) payload.bookingId = editingReservation.id;

        const response = await fetch(editingReservation?.id ? "/.netlify/functions/update-booking-request" : "/.netlify/functions/create-personal-booking", {
          method: "POST",
          headers: await getAdminFetchHeaders(),
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Erreur enregistrement réservation.");
        alert(editingReservation?.id ? "Réservation modifiée." : (result.paymentLink ? "Réservation créée et lien de paiement envoyé." : "Réservation créée."));
        onSelectReservation?.(result.booking);
        onCalendarUpdated?.();
      }

      if (selectionForm.action === "price") {
        const response = await fetch("/.netlify/functions/save-price-rule", {
          method: "POST",
          headers: await getAdminFetchHeaders(),
          body: JSON.stringify({
            action: "create",
            ruleType: "override",
            label: selectionForm.priceLabel || "Tarif spécifique",
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            nightPrice: Number(selectionForm.nightPrice || 0),
            reason: selectionForm.priceReason || "ajustement",
            notes: selectionForm.priceNotes || selectionForm.notes || null,
          }),
        });

        if (!response.ok) throw new Error(await response.text());
        alert("Tarif spécifique enregistré.");
      }

      setPendingRangeStart(null);
      setSelectedPeriod(null);
      setEditingReservation(null);
      await loadCalendar();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function deleteBlock(blockId) {
    if (!window.confirm("Supprimer ce blocage admin ?")) return;
    const { error } = await supabase.from("calendar_blocks").delete().eq("id", blockId);
    if (error) return alert("Erreur suppression : " + error.message);
    setSelectedExternalEvent(null);
    await loadCalendar();
  }

  async function deletePriceRule(ruleType, id) {
    if (!window.confirm("Supprimer cette règle de prix ?")) return;

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({ action: "delete", ruleType, id }),
      });

      if (!response.ok) throw new Error(await response.text());
      await loadCalendar();
    } catch (error) {
      alert("Erreur suppression tarif : " + error.message);
    }
  }


  function editDefaultNightPrice() {
    alert("La modification du tarif par défaut se fait maintenant dans l’onglet Tarifs, avec une interface complète.");
  }

  function editSeasonPrice() {
    alert("La modification des saisons se fait maintenant dans l’onglet Tarifs, avec une interface complète.");
  }

  async function applyExternalCalendarAction(payload) {
    try {
      const response = await fetch("/.netlify/functions/apply-external-calendar-action", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Erreur traitement import externe.");

      alert("Import externe traité.");
      setSelectedExternalEvent(null);
      setSelectedCalendarReservation(null);
      await loadCalendar();
      onCalendarUpdated?.();
      return result;
    } catch (error) {
      alert("Erreur : " + error.message);
      throw error;
    }
  }


  const seasonPeriods = useMemo(() => {
    const fallbackPrice = defaultNightPrice === null ? 0 : Number(defaultNightPrice);
    return (seasonPrices || [])
      .filter((period) => period?.is_active !== false)
      .map((period) => ({
        id: period.id,
        label: period.label,
        start: String(period.start_date || "").slice(0, 10),
        end: String(period.end_date || "").slice(0, 10),
        price: Number(period.night_price || fallbackPrice),
      }))
      .filter((period) => period.start && period.end);
  }, [seasonPrices, defaultNightPrice]);

  const priceOverridePeriods = useMemo(() => {
    const fallbackPrice = defaultNightPrice === null ? 0 : Number(defaultNightPrice);
    return (priceOverrides || [])
      .filter((override) => override?.is_active !== false)
      .map((override) => ({
        id: override.id,
        label: override.label,
        start: String(override.start_date || "").slice(0, 10),
        end: String(override.end_date || "").slice(0, 10),
        price: Number(override.night_price || fallbackPrice),
      }))
      .filter((override) => override.start && override.end);
  }, [priceOverrides, defaultNightPrice]);

  const selectedPeriodTotal = useMemo(() => {
    if (!selectedPeriod) return 0;
    return computeTotal(selectedPeriod.startStr, selectedPeriod.endStr);
  }, [selectedPeriod, seasonPrices, priceOverrides, defaultNightPrice]);

  const calendarEvents = useMemo(() => {
    const selectedRangeEvent = selectedPeriod
      ? [{
          id: "admin-selected-period",
          title: "Période sélectionnée",
          start: selectedPeriod.startStr,
          end: selectedPeriod.endStr,
          display: "background",
          backgroundColor: "rgba(249, 115, 22, 0.22)",
          borderColor: "#f97316",
          extendedProps: { type: "selected_period" },
        }]
      : [];

    const visualEvents = events.map((event) => {
      if (!isVisualHalfDayEvent(event)) return event;

      const sourceStart = String(getSourceStart(event) || "").slice(0, 10);
      const sourceEnd = String(getSourceEnd(event) || "").slice(0, 10);

      return {
        ...event,
        start: sourceStart || event.start,
        // FullCalendar utilise une date de fin exclusive.
        // Pour afficher le départ jusqu'au milieu du jour de départ, on inclut visuellement ce jour
        // puis le CSS raccourcit la barre à droite d'une demi-cellule.
        end: sourceEnd ? addOneDayDate(sourceEnd) : event.end,
        allDay: true,
        display: "block",
        extendedProps: {
          ...event.extendedProps,
          real_start_date: sourceStart || event.start,
          real_end_date: sourceEnd || event.end,
          calendar_display_title: event.title,
        },
      };
    });

    return [...selectedRangeEvent, ...visualEvents];
  }, [events, selectedPeriod]);

  const calendarSummary = useMemo(() => {
    const external = events.filter((event) => event.extendedProps?.type === "external").length;
    const direct = events.filter((event) => event.extendedProps?.type === "booking_request").length;
    const adminBlocks = events.filter((event) => event.extendedProps?.type === "admin_block").length;

    return {
      external,
      direct,
      adminBlocks,
      priceRules: (seasonPrices?.length || 0) + (priceOverrides?.length || 0),
    };
  }, [events, seasonPrices, priceOverrides]);

  const legendItems = mode === "housekeeping" ? [
    { color: "#0f766e", label: "Séjour" },
  ] : [
    { color: COLORS.pending, label: "Demande en attente" },
    { color: COLORS.accepted, label: "Acceptée — attente paiement" },
    { color: COLORS.deposit_paid, label: "Acompte payé" },
    { color: COLORS.fully_paid, label: "Solde payé / confirmée" },
    { color: COLORS.booking, label: "Booking" },
    { color: COLORS.airbnb, label: "Airbnb" },
    { color: COLORS.personal, label: "Réservation personnelle" },
    { color: COLORS.admin_block, label: "Dates bloquées" },
    { color: COLORS.price, label: "Tarif spécifique / saison" },
  ];

  return (
    <div style={styles.wrapper}>
      <style>{calendarCss}</style>
      <CalendarToolbar
        loading={loading}
        summary={calendarSummary}
        selectedPeriod={selectedPeriod}
        pendingRangeStart={pendingRangeStart}
        onRefresh={mode === "housekeeping" ? onCalendarUpdated : loadCalendar}
        onClearSelection={() => {
          clearEditionAndSelection();
        }}
      />

      <CalendarLegend items={legendItems} />

      {loading && <p>Chargement du calendrier...</p>}

      <div className="calendar-admin-layout" style={styles.layout}>
        <div className="calendar-admin-calendar-scroll" style={styles.calendarScroll}><div className="calendar-admin-calendar" style={styles.calendar}>
          <FullCalendar
            key={`${calendarRenderKey}-${pricingVersion}`}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            firstDay={1}
            height="auto"
            fixedWeekCount={false}
            expandRows={true}
            dayMaxEventRows={5}
            buttonText={{ today: "Aujourd’hui", month: "Mois" }}
            events={calendarEvents}
            selectable={mode !== "housekeeping"}
            selectAllow={(selectInfo) => mode !== "housekeeping" && !selectionStartsBeforeToday(selectInfo)}
            selectMirror={true}
            select={handleDateSelect}
            dateClick={handleDateClick}
            eventClick={openEvent}
            displayEventTime={false}
            eventClassNames={(arg) => {
              if (!isVisualHalfDayEvent(arg.event)) return [];
              return [
                "fc-reservation-half-day",
                `fc-reservation-${arg.event.extendedProps.type}`,
              ];
            }}
            eventDidMount={updateHalfDayEdge}
            dayCellContent={(arg) => {
              const key = formatLocalDate(arg.date);
              const isPendingStart = pendingRangeStart === key;
              const isPastDay = isBeforeToday(key);
              const isSelectedRangeDay = isDateInSelectedPeriod(key, selectedPeriod);

              const cellStyle = isPastDay
                ? { ...styles.dayCellContent, ...styles.pastDayCell }
                : isPendingStart
                  ? { ...styles.dayCellContent, ...styles.pendingStartCell }
                  : isSelectedRangeDay
                    ? { ...styles.dayCellContent, ...styles.selectedRangeCell }
                    : styles.dayCellContent;

              const pillStyle = isPendingStart
                ? styles.pendingStartPill
                : isSelectedRangeDay
                  ? styles.selectedRangePill
                  : styles.dayPricePill;

              return (
                <div style={cellStyle}>
                  <div>{arg.dayNumberText}</div>
                  {mode !== "housekeeping" && (
                    <div style={pillStyle}>
                      {isPastDay ? "Passé" : (isPendingStart ? "Début" : (isSelectedRangeDay ? "Sélection" : (getPriceForDate(key) === null ? "..." : `${getPriceForDate(key)}€`)))}
                    </div>
                  )}
                </div>
              );
            }}
          />
          </div>
        </div>

        <aside className="calendar-admin-side-panel" style={styles.sidePanel}>
          {!selectedExternalEvent && !selectedPeriod && !selectedCalendarReservation ? (
            <CalendarHomePanel
              events={events}
              mode={mode}
              onOpenReservation={(reservation) => {
                setSelectedExternalEvent(null);
                setSelectedPeriod(null);
                setEditingReservation(null);
                          setSelectedCalendarReservation(reservation);
              }}
              onStartBlock={() => setPendingRangeStart(null)}
            />
          ) : selectedCalendarReservation ? (
            <div>
              <button
                style={styles.closePanelButton}
                onClick={() => {
                  setSelectedCalendarReservation(null);
                            }}
              >
                Fermer la fiche
              </button>

              {mode === "housekeeping" ? (
                <HousekeepingReservationView
                  reservation={selectedCalendarReservation}
                  onEmail={contactEmail}
                  onPhone={contactPhone}
                  onSms={contactSms}
                  onCreateNote={onHousekeepingNoteCreate}
                />
              ) : (
                <ReservationSummaryPanel
                  reservation={selectedCalendarReservation}
                  onEmail={contactEmail}
                  onPhone={contactPhone}
                  onSms={contactSms}
                  onOpenFull={() => {
                    const reservationToOpen = selectedCalendarReservation;
                    setSelectedCalendarReservation(null);
                    setSelectedExternalEvent(null);
                    setSelectedPeriod(null);
                    setEditingReservation(null);
                    onSelectReservation?.(reservationToOpen);
                  }}
                />
              )}
            </div>
          ) : selectedPeriod ? (
            <SelectionPanel
              selection={selectedPeriod}
              form={selectionForm}
              setForm={setSelectionForm}
              total={selectedPeriodTotal}
              customers={customers}
              mode={editingReservation ? "edit" : "create"}
              editingReservation={editingReservation}
              onClose={clearEditionAndSelection}
              onSubmit={saveSelectionAction}
            />
          ) : (
            <div>
              <button style={styles.closePanelButton} onClick={() => setSelectedExternalEvent(null)}>Fermer la fiche</button>
              <EventPanel
                event={selectedExternalEvent}
                onDeleteBlock={deleteBlock}
                onApplyExternalAction={applyExternalCalendarAction}
              />
            </div>
          )}
        </aside>
      </div>


      {mode !== "housekeeping" && <section style={styles.blockList}>
        <h3>Blocages admin</h3>
        {blocks.length === 0 ? (
          <p style={styles.muted}>Aucun blocage admin enregistré.</p>
        ) : (
          blocks.map((block) => (
            <div key={block.id} style={styles.blockItem}>
              <div>
                <strong>{block.title || "Blocage admin"}</strong>
                <p style={styles.muted}>{formatDate(block.start_date)} → {formatDate(block.end_date)}</p>
                {block.notes && <p style={styles.muted}>{block.notes}</p>}
              </div>
              <button style={styles.deleteButton} onClick={() => deleteBlock(block.id)}>Supprimer</button>
            </div>
          ))
        )}
      </section>}
    </div>
  );
}
