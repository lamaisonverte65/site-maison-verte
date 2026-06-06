import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "../supabaseClient";

const COLORS = {
  airbnb: "#ff5a5f",
  booking: "#003580",
  pending: "#f59e0b",
  accepted: "#f97316",
  deposit_paid: "#2563eb",
  paid: "#14532d",
  fully_paid: "#052e16",
  confirmed: "#15803d",
  admin_block: "#7c3aed",
  price: "#0f766e",
};

function getColor(status) {
  return COLORS[status] || "#6b7280";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function emptyClientForm() {
  return { firstName: "", lastName: "", phone: "", email: "", notes: "" };
}


function isBeforeToday(dateStr) {
  const value = parseLocalDate(dateStr);
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  value.setHours(0, 0, 0, 0);
  return value < today;
}

function selectionStartsBeforeToday(selectionInfo) {
  return isBeforeToday(selectionInfo?.startStr);
}
function emptySelectionForm(selection = null) {
  return {
    action: "block",
    title: "Blocage admin",
    notes: "",
    reservationType: "personal",
    customerMode: "existing",
    customerId: "",
    customerSearch: "",
    displayName: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
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

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}



function nightsBetween(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) return [];
  const nights = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    nights.push(formatLocalDate(d));
  }
  return nights;
}

function isDateInSelectedPeriod(key, selectedPeriod) {
  if (!selectedPeriod?.startStr || !selectedPeriod?.endStr) return false;
  return key >= selectedPeriod.startStr && key < selectedPeriod.endStr;
}

export default function CalendarAdmin({ onSelectReservation, onCalendarUpdated }) {
  const [events, setEvents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState([]);
  const [defaultNightPrice, setDefaultNightPrice] = useState(null);
  const [pricingVersion, setPricingVersion] = useState(0);
  const [calendarRenderKey, setCalendarRenderKey] = useState(0);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [pendingRangeStart, setPendingRangeStart] = useState(null);
  const [selectionForm, setSelectionForm] = useState(emptySelectionForm());
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
    loadCustomers();
  }, []);

  async function getAdminFetchHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  async function loadCustomers() {
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
    setLoading(true);

    try {
      const calendarResponse = await fetch("/.netlify/functions/calendar");
      const calendarData = await calendarResponse.json();

      const pricing = await loadPricing();

      const { data: externalClientLinks } = await supabase
        .from("external_reservation_clients")
        .select("*");

      const externalEvents = (calendarData.externalReservations || []).map((reservation) => {
        const linkedClient = (externalClientLinks || []).find((item) => item.uid === reservation.uid);
        const clientName = linkedClient
          ? [linkedClient.guest_first_name, linkedClient.guest_last_name].filter(Boolean).join(" ")
          : "";
        const sourceLabel = reservation.source === "airbnb" ? "Airbnb" : "Booking";
        const color = reservation.source === "airbnb" ? COLORS.airbnb : COLORS.booking;

        return {
          id: reservation.uid,
          title: clientName ? `${sourceLabel} - ${clientName}` : sourceLabel,
          start: reservation.start_date,
          end: reservation.end_date,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            type: "external",
            source: reservation.source,
            uid: reservation.uid,
            start_date: reservation.start_date,
            end_date: reservation.end_date,
            linkedClient,
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
          const color = getColor(status);
          const price = reservation.owner_price || reservation.estimated_total;
          const isAdminPersonal = reservation.source === "admin_personal" || reservation.contract_version === "admin_personal";
          const isAdminClient = reservation.source === "admin_client";
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
      onSelectReservation?.(props.reservation);
      return;
    }

    if (props.type === "external") {
      const existing = props.linkedClient || {};
      setClientForm({
        firstName: existing.guest_first_name || "",
        lastName: existing.guest_last_name || "",
        phone: existing.guest_phone || "",
        email: existing.guest_email || "",
        notes: existing.notes || "",
      });
      setSelectedPeriod(null);
      setSelectedExternalEvent({ title: info.event.title, start: info.event.startStr, end: info.event.endStr, ...props });
      return;
    }

    if (props.type === "admin_block") {
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

  function openSelectedPeriod(selectionInfo) {
    const computedTotal = computeTotal(selectionInfo.startStr, selectionInfo.endStr);
    setSelectedExternalEvent(null);
    setSelectedPeriod(selectionInfo);
    setSelectionForm({
      ...emptySelectionForm(selectionInfo),
      total: "0",
      nightPrice: String(getPriceForDate(selectionInfo.startStr)),
    });
  }

  function handleDateSelect(selectionInfo) {
    if (selectionStartsBeforeToday(selectionInfo)) {
      setPendingRangeStart(null);
      setSelectedPeriod(null);
      return;
    }
    openSelectedPeriod(selectionInfo);
  }

  function handleDateClick(info) {
    if (isBeforeToday(info.dateStr)) {
      setPendingRangeStart(null);
      setSelectedPeriod(null);
      return;
    }
    const clickedDate = parseLocalDate(info.dateStr);
    if (!clickedDate) return;

    setSelectedExternalEvent(null);

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
    const lastClickedDate = pendingRangeStart < info.dateStr ? clickedDate : parseLocalDate(pendingRangeStart);
    const endDate = new Date(lastClickedDate);
    endDate.setDate(endDate.getDate() + 1);

    setPendingRangeStart(null);
    openSelectedPeriod(buildSelectionFromDates(start, formatLocalDate(endDate)));
  }

  async function saveSelectionAction(event) {
    event.preventDefault();

    if (!selectedPeriod) return;

    try {
      if (selectionForm.action === "block") {
        const { error } = await supabase.from("calendar_blocks").insert([
          {
            title: selectionForm.title || "Blocage admin",
            start_date: selectedPeriod.startStr,
            end_date: selectedPeriod.endStr,
            notes: selectionForm.notes || null,
            source: "admin",
            status: "blocked",
          },
        ]);

        if (error) throw error;
        alert("Dates bloquées.");
      }

      if (selectionForm.action === "personal") {
        const total = Number(String(selectionForm.total || "0").replace(",", "."));

        if (selectionForm.reservationType === "personal" && !selectionForm.displayName.trim()) {
          return alert("Le nom affiché est obligatoire pour garder une information claire dans le calendrier.");
        }

        if (selectionForm.reservationType === "client") {
          if (selectionForm.customerMode === "existing" && !selectionForm.customerId) {
            return alert("Choisis un client existant ou crée un nouveau client.");
          }
          if (selectionForm.customerMode === "new" && (!selectionForm.firstName.trim() || !selectionForm.lastName.trim())) {
            return alert("Le prénom et le nom du nouveau client sont obligatoires.");
          }
        }

        if (total > 0 && selectionForm.sendPaymentLink && !selectionForm.email.trim() && selectionForm.customerMode !== "existing") {
          return alert("Un email est obligatoire pour envoyer un lien de paiement Stripe.");
        }

        const response = await fetch("/.netlify/functions/create-personal-booking", {
          method: "POST",
          headers: await getAdminFetchHeaders(),
          body: JSON.stringify({
            bookingKind: selectionForm.reservationType,
            customerMode: selectionForm.customerMode,
            customerId: selectionForm.customerId || null,
            startDate: selectedPeriod.startStr,
            endDate: selectedPeriod.endStr,
            displayName: selectionForm.displayName,
            firstName: selectionForm.firstName,
            lastName: selectionForm.lastName,
            phone: selectionForm.phone,
            email: selectionForm.email,
            total,
            amountPaid: Number(String(selectionForm.amountPaid || "0").replace(",", ".")),
            sendPaymentLink: Boolean(selectionForm.sendPaymentLink),
            notes: selectionForm.notes,
          }),
        });

        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();
        alert(result.paymentLink ? "Réservation créée et lien de paiement envoyé." : "Réservation créée.");
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
            startDate: selectedPeriod.startStr,
            endDate: selectedPeriod.endStr,
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

  async function createOrUpdateCustomer({ firstName, lastName, email, phone, source, notes }) {
    let existingCustomer = null;

    if (email) {
      const { data } = await supabase.from("customers").select("*").eq("email", email).maybeSingle();
      existingCustomer = data;
    }

    if (!existingCustomer && phone) {
      const { data } = await supabase.from("customers").select("*").eq("phone", phone).maybeSingle();
      existingCustomer = data;
    }

    if (!existingCustomer && firstName && lastName) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .ilike("first_name", firstName)
        .ilike("last_name", lastName)
        .maybeSingle();
      existingCustomer = data;
    }

    if (existingCustomer) {
      const { data, error } = await supabase
        .from("customers")
        .update({
          first_name: firstName || existingCustomer.first_name,
          last_name: lastName || existingCustomer.last_name,
          email: email || existingCustomer.email,
          phone: phone || existingCustomer.phone,
          source: source || existingCustomer.source,
          notes: notes || existingCustomer.notes,
          last_stay: selectedExternalEvent?.end_date || selectedExternalEvent?.end || existingCustomer.last_stay,
        })
        .eq("id", existingCustomer.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert([
        {
          first_name: firstName || null,
          last_name: lastName || null,
          email: email || null,
          phone: phone || null,
          source,
          notes: notes || null,
          first_stay: selectedExternalEvent?.start_date || selectedExternalEvent?.start || null,
          last_stay: selectedExternalEvent?.end_date || selectedExternalEvent?.end || null,
          booking_count: 1,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function saveExternalClient() {
    if (!selectedExternalEvent || selectedExternalEvent.type !== "external") return;

    try {
      const customer = await createOrUpdateCustomer({
        firstName: clientForm.firstName.trim(),
        lastName: clientForm.lastName.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim(),
        source: selectedExternalEvent.source,
        notes: clientForm.notes.trim(),
      });

      const { error } = await supabase.from("external_reservation_clients").upsert(
        {
          uid: selectedExternalEvent.uid,
          source: selectedExternalEvent.source,
          start_date: selectedExternalEvent.start_date,
          end_date: selectedExternalEvent.end_date,
          customer_id: customer.id,
          guest_first_name: clientForm.firstName.trim() || null,
          guest_last_name: clientForm.lastName.trim() || null,
          guest_email: clientForm.email.trim() || null,
          guest_phone: clientForm.phone.trim() || null,
          notes: clientForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "uid" }
      );

      if (error) throw error;
      alert("Client enregistré et lié à la réservation externe.");
      setSelectedExternalEvent(null);
      await loadCalendar();
    } catch (error) {
      alert("Erreur : " + error.message);
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

    return [...selectedRangeEvent, ...events];
  }, [events, selectedPeriod]);

  return (
    <div style={styles.wrapper}>
      <style>{`
        @media (max-width: 900px) {
          .calendar-admin-layout {
            grid-template-columns: 1fr !important;
          }

          .calendar-admin-side-panel {
            order: 2;
            position: static !important;
            max-height: none !important;
          }

          .calendar-admin-calendar-scroll {
            order: 1;
            overflow-x: auto;
            padding-bottom: 10px;
            -webkit-overflow-scrolling: touch;
          }

          .calendar-admin-calendar {
            min-width: 760px;
          }

          .calendar-admin-calendar .fc {
            font-size: 0.92rem;
          }

          .calendar-admin-calendar .fc-daygrid-day-frame {
            min-height: 82px;
          }

          .calendar-admin-calendar .fc-bg-event {
            opacity: 1 !important;
          }
        }
      `}</style>
      <div style={styles.legend}>
        <Legend color={COLORS.airbnb} label="Airbnb" />
        <Legend color={COLORS.booking} label="Booking" />
        <Legend color={COLORS.pending} label="Demande" />
        <Legend color={COLORS.accepted} label="Acceptée" />
        <Legend color={COLORS.deposit_paid} label="Acompte payé" />
        <Legend color={COLORS.confirmed} label="Confirmée" />
        <Legend color={COLORS.admin_block} label="Blocage" />
        <Legend color={COLORS.price} label="Tarif spécifique / saison" />
      </div>

      {loading && <p>Chargement du calendrier...</p>}

      <div className="calendar-admin-layout" style={styles.layout}>
        <div className="calendar-admin-calendar-scroll" style={styles.calendarScroll}><div className="calendar-admin-calendar" style={styles.calendar}>
          <FullCalendar
            key={`${calendarRenderKey}-${pricingVersion}`}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            height="auto"
            events={calendarEvents}
            selectable={true}
            selectAllow={(selectInfo) => !selectionStartsBeforeToday(selectInfo)}
            selectMirror={true}
            select={handleDateSelect}
            dateClick={handleDateClick}
            eventClick={openEvent}
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
                  <div style={pillStyle}>
                    {isPastDay ? "Passé" : (isPendingStart ? "Début" : (isSelectedRangeDay ? "Sélection" : (getPriceForDate(key) === null ? "..." : `${getPriceForDate(key)}€`)))}
                  </div>
                </div>
              );
            }}
          />
          </div>
        </div>

        <aside className="calendar-admin-side-panel" style={styles.sidePanel}>
          {!selectedExternalEvent && !selectedPeriod ? (
            <div>
              <h3>Fiche calendrier</h3>
              {pendingRangeStart ? (
                <p style={styles.selectionHint}>Début sélectionné : {formatDate(pendingRangeStart)}. Clique maintenant sur la date de fin.</p>
              ) : (
                <p style={styles.muted}>Clique une première date de début, puis une date de fin pour sélectionner une période.</p>
              )}
              <p style={styles.muted}>Tu peux ensuite bloquer, créer une réservation ou changer les tarifs.</p>
              <p style={styles.muted}>Les prix affichés ici utilisent exactement les mêmes données que le calendrier du site public.</p>
              <p style={styles.muted}>Clique sur une réservation directe pour ouvrir la fiche résa centrale.</p>
              <p style={styles.muted}>Clique sur Airbnb/Booking pour renseigner les infos client.</p>
            </div>
          ) : selectedPeriod ? (
            <SelectionPanel
              selection={selectedPeriod}
              form={selectionForm}
              setForm={setSelectionForm}
              total={selectedPeriodTotal}
              customers={customers}
              onClose={() => { setPendingRangeStart(null); setSelectedPeriod(null); }}
              onSubmit={saveSelectionAction}
            />
          ) : (
            <div>
              <button style={styles.closePanelButton} onClick={() => setSelectedExternalEvent(null)}>Fermer la fiche</button>
              <EventPanel
                event={selectedExternalEvent}
                clientForm={clientForm}
                setClientForm={setClientForm}
                onSaveExternal={saveExternalClient}
                onDeleteBlock={deleteBlock}
              />
            </div>
          )}
        </aside>
      </div>


      <section style={styles.blockList}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Tarif par défaut</h3>
            <p style={styles.muted}>Ce tarif est utilisé hors saison et hors tarif spécifique.</p>
          </div>
          <button style={styles.primaryButton} onClick={editDefaultNightPrice}>Modifier dans Tarifs</button>
        </div>
        <div style={styles.priceItem}>
          <strong>{defaultNightPrice === null ? "Chargement..." : `${formatMoney(defaultNightPrice)} / nuit`}</strong>
          <p style={styles.muted}>Priorité appliquée : tarif spécifique → tarif saisonnier → tarif par défaut.</p>
        </div>
      </section>

      <section style={styles.blockList}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Tarifs saisonniers</h3>
            <p style={styles.muted}>Tu peux modifier les dates et prix des vacances année par année.</p>
          </div>
          <button style={styles.primaryButton} onClick={() => editSeasonPrice(null)}>Gérer dans Tarifs</button>
        </div>
        {seasonPrices.length === 0 ? (
          <p style={styles.muted}>Aucun tarif saisonnier.</p>
        ) : (
          <div style={styles.priceGrid}>
            {seasonPrices.map((rule) => (
              <div key={rule.id} style={styles.priceItem}>
                <strong>{rule.label}</strong>
                <p style={styles.muted}>{formatDate(rule.start_date)} → {formatDate(rule.end_date)} · {formatMoney(rule.night_price)} / nuit</p>
                {rule.minimum_nights && <p style={styles.muted}>Minimum : {rule.minimum_nights} nuits</p>}
                {rule.notes && <p style={styles.muted}>{rule.notes}</p>}
                <p style={styles.muted}>Modification centralisée dans l’onglet Tarifs.</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.blockList}>
        <h3>Tarifs spécifiques</h3>
        {priceOverrides.length === 0 ? (
          <p style={styles.muted}>Aucun tarif spécifique enregistré.</p>
        ) : (
          <div style={styles.priceGrid}>
            {priceOverrides.map((rule) => (
              <div key={rule.id} style={styles.priceItem}>
                <strong>{rule.label}</strong>
                <p style={styles.muted}>{formatDate(rule.start_date)} → {formatDate(rule.end_date)} · {formatMoney(rule.night_price)} / nuit</p>
                {rule.reason && <p style={styles.muted}>Motif : {rule.reason}</p>}
                {rule.notes && <p style={styles.muted}>{rule.notes}</p>}
                <button style={styles.deleteButton} onClick={() => deletePriceRule("override", rule.id)}>Supprimer</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.blockList}>
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
      </section>
    </div>
  );
}

function SelectionPanel({ selection, form, setForm, total, customers = [], onClose, onSubmit }) {
  const selectedCustomer = customers.find((customer) => String(customer.id) === String(form.customerId));
  const search = String(form.customerSearch || "").toLowerCase().trim();
  const filteredCustomers = customers
    .filter((customer) => {
      if (!search) return true;
      return [customer.first_name, customer.last_name, customer.email, customer.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .slice(0, 80);

  function updateReservationType(nextType) {
    setForm({
      ...form,
      reservationType: nextType,
      total: nextType === "client" ? String(total || 0) : "0",
      amountPaid: "0",
    });
  }

  function updateCustomerMode(nextMode) {
    setForm({
      ...form,
      customerMode: nextMode,
      customerId: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    });
  }

  function updateSelectedCustomer(customerId) {
    const customer = customers.find((item) => String(item.id) === String(customerId));
    setForm({
      ...form,
      customerId,
      firstName: customer?.first_name || "",
      lastName: customer?.last_name || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
    });
  }

  const totalNumber = Number(String(form.total || "0").replace(",", "."));
  const needsPaymentEmail = totalNumber > 0 && form.sendPaymentLink;

  return (
    <form onSubmit={onSubmit}>
      <button type="button" style={styles.closePanelButton} onClick={onClose}>Fermer</button>
      <h3>Période sélectionnée</h3>
      <p style={styles.muted}>{formatDate(selection.startStr)} → {formatDate(selection.endStr)}</p>
      <p style={styles.muted}>Total théorique selon tarifs actuels : <strong>{formatMoney(total)}</strong></p>

      <label style={styles.label}>Action
        <select style={styles.input} value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })}>
          <option value="block">Bloquer les dates</option>
          <option value="personal">Créer une réservation</option>
          <option value="price">Changer les tarifs de cette période</option>
        </select>
      </label>

      {form.action === "block" && (
        <>
          <input style={styles.input} placeholder="Titre" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <textarea style={styles.textarea} placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </>
      )}

      {form.action === "personal" && (
        <div style={styles.formGrid}>
          <label style={styles.label}>Type de réservation
            <select style={styles.input} value={form.reservationType} onChange={(event) => updateReservationType(event.target.value)}>
              <option value="personal">Réservation personnelle / famille / amis</option>
              <option value="client">Réservation client</option>
            </select>
          </label>

          {form.reservationType === "personal" && (
            <>
              <input style={styles.input} placeholder="Nom affiché dans le calendrier * (ex : Famille Benoit, Amis de Toulouse)" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              <input style={styles.input} placeholder="Prix du séjour (€) — 0 par défaut" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
              {totalNumber > 0 && (
                <>
                  <label style={styles.checkboxLine}>
                    <input type="checkbox" checked={form.sendPaymentLink} onChange={(event) => setForm({ ...form, sendPaymentLink: event.target.checked })} />
                    Envoyer un lien de paiement Stripe
                  </label>
                  {form.sendPaymentLink && <input style={styles.input} placeholder="Email pour envoyer le lien de paiement *" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />}
                  <input style={styles.input} placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </>
              )}
              <textarea style={styles.textarea} placeholder="Notes internes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </>
          )}

          {form.reservationType === "client" && (
            <>
              <label style={styles.label}>Client
                <select style={styles.input} value={form.customerMode} onChange={(event) => updateCustomerMode(event.target.value)}>
                  <option value="existing">Choisir un client existant</option>
                  <option value="new">Créer un nouveau client</option>
                </select>
              </label>

              {form.customerMode === "existing" && (
                <>
                  <input style={styles.input} placeholder="Rechercher un client..." value={form.customerSearch} onChange={(event) => setForm({ ...form, customerSearch: event.target.value })} />
                  <select style={styles.input} value={form.customerId} onChange={(event) => updateSelectedCustomer(event.target.value)}>
                    <option value="">Sélectionner un client</option>
                    {filteredCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {[customer.last_name, customer.first_name].filter(Boolean).join(" ") || "Client sans nom"} {customer.email ? `— ${customer.email}` : customer.phone ? `— ${customer.phone}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <p style={styles.muted}>
                      Client sélectionné : {[selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(" ")} {selectedCustomer.email ? `· ${selectedCustomer.email}` : ""}
                    </p>
                  )}
                </>
              )}

              {form.customerMode === "new" && (
                <>
                  <input style={styles.input} placeholder="Prénom *" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                  <input style={styles.input} placeholder="Nom *" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                  <input style={styles.input} placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                  <input style={styles.input} placeholder={needsPaymentEmail ? "Email *" : "Email"} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </>
              )}

              <input style={styles.input} placeholder="Prix du séjour (€)" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
              <label style={styles.checkboxLine}>
                <input type="checkbox" checked={form.sendPaymentLink} onChange={(event) => setForm({ ...form, sendPaymentLink: event.target.checked })} />
                Envoyer le lien de paiement immédiatement si prix &gt; 0
              </label>
              <textarea style={styles.textarea} placeholder="Notes internes / message" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </>
          )}
        </div>
      )}

      {form.action === "price" && (
        <div style={styles.formGrid}>
          <input style={styles.input} placeholder="Nom du tarif" value={form.priceLabel} onChange={(event) => setForm({ ...form, priceLabel: event.target.value })} />
          <input style={styles.input} placeholder="Prix par nuit (€)" value={form.nightPrice} onChange={(event) => setForm({ ...form, nightPrice: event.target.value })} />
          <select style={styles.input} value={form.priceReason} onChange={(event) => setForm({ ...form, priceReason: event.target.value })}>
            <option value="ajustement">Ajustement</option>
            <option value="promo">Promo</option>
            <option value="vacances">Vacances</option>
            <option value="pont">Pont / week-end spécial</option>
            <option value="evenement">Événement</option>
          </select>
          <textarea style={styles.textarea} placeholder="Notes" value={form.priceNotes} onChange={(event) => setForm({ ...form, priceNotes: event.target.value })} />
        </div>
      )}

      <button style={styles.primaryButton} type="submit">Valider</button>
    </form>
  );
}

function EventPanel({ event, clientForm, setClientForm, onSaveExternal, onDeleteBlock }) {
  if (event.type === "external") {
    return (
      <div>
        <h3>{event.source === "airbnb" ? "Réservation Airbnb" : "Réservation Booking"}</h3>
        <p style={styles.muted}>{formatDate(event.start_date)} → {formatDate(event.end_date)}</p>
        <div style={styles.formGrid}>
          <input style={styles.input} placeholder="Prénom" value={clientForm.firstName} onChange={(event) => setClientForm({ ...clientForm, firstName: event.target.value })} />
          <input style={styles.input} placeholder="Nom" value={clientForm.lastName} onChange={(event) => setClientForm({ ...clientForm, lastName: event.target.value })} />
          <input style={styles.input} placeholder="Téléphone" value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
          <input style={styles.input} placeholder="Email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} />
          <textarea style={styles.textarea} placeholder="Notes internes" value={clientForm.notes} onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })} />
        </div>
        <button style={styles.primaryButton} onClick={onSaveExternal}>Enregistrer la fiche client</button>
      </div>
    );
  }

  if (event.type === "admin_block") {
    const block = event.block;
    return (
      <div>
        <h3>Blocage admin</h3>
        <p><strong>{block.title}</strong></p>
        <p style={styles.muted}>{formatDate(block.start_date)} → {formatDate(block.end_date)}</p>
        {block.notes && <p>{block.notes}</p>}
        <button style={styles.deleteButton} onClick={() => onDeleteBlock(block.id)}>Débloquer / supprimer</button>
      </div>
    );
  }

  return null;
}

function Legend({ color, label }) {
  return <div style={styles.legendItem}><div style={{ width: "14px", height: "14px", borderRadius: "999px", background: color }} /><span>{label}</span></div>;
}

const styles = {
  calendarScroll: {
    width: "100%",
  },
  pendingStartCell: {
    background: "#fff7ed",
    border: "2px solid #f97316",
    borderRadius: "14px",
    padding: "4px",
  },
  pendingStartPill: {
    marginTop: "4px",
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#f97316",
    color: "white",
    fontSize: "0.75rem",
    fontWeight: 800,
  },
  selectedRangeCell: {
    background: "#ffedd5",
    border: "2px solid #fb923c",
    borderRadius: "14px",
    padding: "4px",
  },
  selectedRangePill: {
    marginTop: "4px",
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#ea580c",
    color: "white",
    fontSize: "0.75rem",
    fontWeight: 800,
  },
  selectionHint: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    padding: "12px",
    borderRadius: "14px",
    lineHeight: 1.5,
    fontWeight: 700,
  },

  wrapper: { background: "white", borderRadius: "24px", padding: "20px" },
  legend: { display: "flex", gap: "18px", marginBottom: "20px", flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: "8px" },
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 400px)", gap: "20px", alignItems: "start" },
  calendar: { minWidth: 0 },
  sidePanel: { background: "#f8fafc", borderRadius: "20px", padding: "18px", position: "sticky", top: "20px" },
  closePanelButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", marginBottom: "12px" },
  muted: { color: "#64748b", margin: "4px 0" },
  label: { display: "grid", gap: "8px", margin: "12px 0", fontWeight: 700 },
  formGrid: { display: "grid", gap: "10px", margin: "16px 0" },
  input: { padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", fontSize: "14px", minHeight: "100px", resize: "vertical", width: "100%", boxSizing: "border-box" },
  checkboxLine: { display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: 700, lineHeight: 1.4 },
  primaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 700 },
  smallButton: { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", fontWeight: 700 },
  deleteButton: { border: "none", borderRadius: "999px", background: "#dc2626", color: "white", padding: "10px 14px", cursor: "pointer" },
  blockList: { marginTop: "28px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  blockItem: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "14px", marginBottom: "10px" },
  priceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" },
  priceItem: { border: "1px solid #e5e7eb", borderRadius: "16px", padding: "14px", background: "#f8fafc" },
  actionsRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" },
  dayCellContent: { display: "grid", gap: "2px", justifyItems: "center" },
  pastDayCell: { opacity: 0.45, filter: "grayscale(1)", cursor: "not-allowed" },
  dayPrice: { fontSize: "11px", color: "#0f766e", fontWeight: 800 },
  dayPricePill: {
    marginTop: "4px",
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#ecfdf5",
    color: "#0f766e",
    fontSize: "0.75rem",
    fontWeight: 800,
  },
};
