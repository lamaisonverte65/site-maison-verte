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

function emptySelectionForm(selection = null) {
  return {
    action: "block",
    title: "Blocage admin",
    notes: "",
    firstName: "Réservation",
    lastName: "personnelle",
    phone: "",
    email: "",
    total: "0",
    amountPaid: "0",
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


function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateWindow(monthsBefore = 2, monthsAfter = 18) {
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBefore);
  start.setDate(1);

  const end = new Date();
  end.setMonth(end.getMonth() + monthsAfter);
  end.setDate(1);

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
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

export default function CalendarAdmin({ onSelectReservation, onCalendarUpdated }) {
  const [events, setEvents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [seasonPrices, setSeasonPrices] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState([]);
  const [defaultNightPrice, setDefaultNightPrice] = useState(80);
  const [pricesByDate, setPricesByDate] = useState({});
  const [calendarRenderKey, setCalendarRenderKey] = useState(0);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectionForm, setSelectionForm] = useState(emptySelectionForm());
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
  }, []);

  async function getAdminFetchHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }


  async function loadPricingByDate() {
    const { startDate, endDate } = getDateWindow(2, 18);

    const response = await fetch(`/.netlify/functions/get-pricing?start=${startDate}&end=${endDate}`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();

    const nextPricesByDate = data.pricesByDate || data.prices || {};
    setPricesByDate(nextPricesByDate);

    if (data.defaultNightPrice || data.defaultPrice) {
      setDefaultNightPrice(Number(data.defaultNightPrice || data.defaultPrice || 80));
    }

    return {
      pricesByDate: nextPricesByDate,
      defaultNightPrice: Number(data.defaultNightPrice || data.defaultPrice || defaultNightPrice || 80),
    };
  }

  async function loadPricing() {
    const { data: settings, error: settingsError } = await supabase
      .from("pricing_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (settingsError) throw settingsError;
    setDefaultNightPrice(Number(settings?.default_night_price || 80));

    const { data: seasons, error: seasonsError } = await supabase
      .from("season_prices")
      .select("*")
      .order("start_date", { ascending: true });

    if (seasonsError) throw seasonsError;

    const { data: overrides, error: overridesError } = await supabase
      .from("price_overrides")
      .select("*")
      .order("start_date", { ascending: true });

    if (overridesError) throw overridesError;

    setSeasonPrices(seasons || []);
    setPriceOverrides(overrides || []);

    return { seasons: seasons || [], overrides: overrides || [], defaultNightPrice: Number(settings?.default_night_price || 80) };
  }

  async function loadCalendar() {
    setLoading(true);

    try {
      const calendarResponse = await fetch("/.netlify/functions/calendar");
      const calendarData = await calendarResponse.json();

      const pricingByDate = await loadPricingByDate();
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
          return {
            id: reservation.id,
            title: `${status === "pending" ? "Demande" : "Direct"} - ${reservation.guest_first_name || "Client"}${price ? ` · ${formatMoney(price)}` : ""}`,
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

      const seasonPriceEvents = (pricing.seasons || []).filter((rule) => rule.is_active !== false).map((rule) => ({
        id: `season-price-${rule.id}`,
        title: `${rule.label} · ${Number(rule.night_price)}€/nuit`,
        start: rule.start_date,
        end: rule.end_date,
        display: "background",
        backgroundColor: "rgba(37,99,235,0.10)",
        extendedProps: { type: "season_price", rule },
      }));

      const overridePriceEvents = (pricing.overrides || []).filter((rule) => rule.is_active !== false).map((rule) => ({
        id: `price-${rule.id}`,
        title: `${rule.label} · ${Number(rule.night_price)}€/nuit`,
        start: rule.start_date,
        end: rule.end_date,
        display: "background",
        backgroundColor: "rgba(15,118,110,0.18)",
        extendedProps: { type: "price_override", rule },
      }));

      setEvents([...seasonPriceEvents, ...overridePriceEvents, ...externalEvents, ...directEvents, ...blockEvents]);
      setCalendarRenderKey((previous) => previous + 1);
    } catch (error) {
      alert("Erreur calendrier : " + error.message);
    }

    setLoading(false);
  }

  function getPriceForDate(key) {
    const cleanKey = String(key || "").slice(0, 10);
    const priceInfo = pricesByDate[cleanKey];

    if (typeof priceInfo === "number") {
      return Number(priceInfo || defaultNightPrice || 80);
    }

    if (priceInfo && typeof priceInfo === "object") {
      return Number(priceInfo.price || priceInfo.nightPrice || priceInfo.night_price || defaultNightPrice || 80);
    }

    return Number(defaultNightPrice || 80);
  }

  function computeTotal(startDate, endDate) {
    return nightsBetween(startDate, endDate).reduce((sum, key) => sum + getPriceForDate(key), 0);
  }

  function openEvent(info) {
    const props = info.event.extendedProps;

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

  function handleDateSelect(selectionInfo) {
    const computedTotal = computeTotal(selectionInfo.startStr, selectionInfo.endStr);
    setSelectedExternalEvent(null);
    setSelectedPeriod(selectionInfo);
    setSelectionForm({
      ...emptySelectionForm(selectionInfo),
      total: String(computedTotal),
      nightPrice: String(getPriceForDate(selectionInfo.startStr)),
    });
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
        const response = await fetch("/.netlify/functions/create-personal-booking", {
          method: "POST",
          headers: await getAdminFetchHeaders(),
          body: JSON.stringify({
            startDate: selectedPeriod.startStr,
            endDate: selectedPeriod.endStr,
            firstName: selectionForm.firstName,
            lastName: selectionForm.lastName,
            phone: selectionForm.phone,
            email: selectionForm.email,
            total: Number(selectionForm.total || 0),
            amountPaid: Number(selectionForm.amountPaid || 0),
            notes: selectionForm.notes,
          }),
        });

        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();
        alert("Réservation personnelle créée.");
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


  async function editDefaultNightPrice() {
    const nightPrice = window.prompt("Tarif par défaut par nuit (€) :", String(defaultNightPrice || 80));
    if (nightPrice === null) return;

    const notes = window.prompt("Notes tarif par défaut :", "Hors saison et hors tarif spécifique");
    if (notes === null) return;

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({
          action: "update_default_price",
          defaultNightPrice: Number(nightPrice),
          notes,
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      await loadCalendar();
    } catch (error) {
      alert("Erreur tarif par défaut : " + error.message);
    }
  }

  async function editSeasonPrice(rule) {
    const label = window.prompt("Nom de la saison :", rule?.label || "Nouvelle saison");
    if (label === null) return;
    const startDate = window.prompt("Date début YYYY-MM-DD :", rule?.start_date || "");
    if (startDate === null) return;
    const endDate = window.prompt("Date fin exclusive YYYY-MM-DD :", rule?.end_date || "");
    if (endDate === null) return;
    const nightPrice = window.prompt("Prix par nuit (€) :", rule?.night_price ?? "80");
    if (nightPrice === null) return;
    const minimumNights = window.prompt("Séjour minimum sur cette saison (vide = 2 nuits) :", rule?.minimum_nights ?? "");
    if (minimumNights === null) return;
    const notes = window.prompt("Notes :", rule?.notes || "");
    if (notes === null) return;

    try {
      const response = await fetch("/.netlify/functions/save-price-rule", {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify({
          action: rule?.id ? "update" : "create",
          ruleType: "season",
          id: rule?.id,
          label,
          startDate,
          endDate,
          nightPrice: Number(nightPrice),
          minimumNights: minimumNights === "" ? null : Number(minimumNights),
          allowedArrivalDays: [0, 6],
          notes,
          isActive: true,
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      await loadCalendar();
    } catch (error) {
      alert("Erreur saison : " + error.message);
    }
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

  const selectedPeriodTotal = useMemo(() => {
    if (!selectedPeriod) return 0;
    return computeTotal(selectedPeriod.startStr, selectedPeriod.endStr);
  }, [selectedPeriod, pricesByDate, defaultNightPrice]);

  return (
    <div style={styles.wrapper}>
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

      <div style={styles.layout}>
        <div style={styles.calendar}>
          <FullCalendar
            key={calendarRenderKey}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            height="auto"
            events={events}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            eventClick={openEvent}
            dayCellContent={(arg) => {
              const key = formatLocalDate(arg.date);
              return (
                <div style={styles.dayCellContent}>
                  <div>{arg.dayNumberText}</div>
                  <div style={styles.dayPrice}>{getPriceForDate(key)}€</div>
                </div>
              );
            }}
          />
        </div>

        <aside style={styles.sidePanel}>
          {!selectedExternalEvent && !selectedPeriod ? (
            <div>
              <h3>Fiche calendrier</h3>
              <p style={styles.muted}>Sélectionne une période pour bloquer, créer une résa perso ou changer les tarifs.</p>
              <p style={styles.muted}>Les prix affichés ici proviennent de la même source serveur que le site public.</p>
              <p style={styles.muted}>Clique sur une réservation directe pour ouvrir la fiche résa centrale.</p>
              <p style={styles.muted}>Clique sur Airbnb/Booking pour renseigner les infos client.</p>
            </div>
          ) : selectedPeriod ? (
            <SelectionPanel
              selection={selectedPeriod}
              form={selectionForm}
              setForm={setSelectionForm}
              total={selectedPeriodTotal}
              onClose={() => setSelectedPeriod(null)}
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
          <button style={styles.primaryButton} onClick={editDefaultNightPrice}>Modifier le tarif par défaut</button>
        </div>
        <div style={styles.priceItem}>
          <strong>{formatMoney(defaultNightPrice)} / nuit</strong>
          <p style={styles.muted}>Priorité appliquée : tarif spécifique → tarif saisonnier → tarif par défaut.</p>
        </div>
      </section>

      <section style={styles.blockList}>
        <div style={styles.sectionHeader}>
          <div>
            <h3>Tarifs saisonniers</h3>
            <p style={styles.muted}>Tu peux modifier les dates et prix des vacances année par année.</p>
          </div>
          <button style={styles.primaryButton} onClick={() => editSeasonPrice(null)}>Ajouter une saison</button>
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
                <div style={styles.actionsRow}>
                  <button style={styles.smallButton} onClick={() => editSeasonPrice(rule)}>Modifier</button>
                  <button style={styles.deleteButton} onClick={() => deletePriceRule("season", rule.id)}>Supprimer</button>
                </div>
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

function SelectionPanel({ selection, form, setForm, total, onClose, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <button type="button" style={styles.closePanelButton} onClick={onClose}>Fermer</button>
      <h3>Période sélectionnée</h3>
      <p style={styles.muted}>{formatDate(selection.startStr)} → {formatDate(selection.endStr)}</p>
      <p style={styles.muted}>Total théorique selon tarifs actuels : <strong>{formatMoney(total)}</strong></p>

      <label style={styles.label}>Action
        <select style={styles.input} value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })}>
          <option value="block">Bloquer les dates</option>
          <option value="personal">Créer une résa perso</option>
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
          <input style={styles.input} placeholder="Prénom" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          <input style={styles.input} placeholder="Nom" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          <input style={styles.input} placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <input style={styles.input} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input style={styles.input} placeholder="Total séjour (€)" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
          <input style={styles.input} placeholder="Montant déjà payé (€)" value={form.amountPaid} onChange={(event) => setForm({ ...form, amountPaid: event.target.value })} />
          <textarea style={styles.textarea} placeholder="Notes internes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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
  dayPrice: { fontSize: "11px", color: "#0f766e", fontWeight: 800 },
};
