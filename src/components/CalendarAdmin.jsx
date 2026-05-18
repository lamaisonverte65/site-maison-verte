import { useEffect, useState } from "react";
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
};

function getColor(status) {
  return COLORS[status] || "#6b7280";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function emptyClientForm() {
  return { firstName: "", lastName: "", phone: "", email: "", notes: "" };
}

export default function CalendarAdmin({ onSelectReservation }) {
  const [events, setEvents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState(null);
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);

    try {
      const calendarResponse = await fetch("/.netlify/functions/calendar");
      const calendarData = await calendarResponse.json();

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
          return {
            id: reservation.id,
            title: status === "pending" ? `Demande - ${reservation.guest_first_name || "Client"}` : `Direct - ${reservation.guest_first_name || "Client"}`,
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
    } catch (error) {
      alert("Erreur calendrier : " + error.message);
    }

    setLoading(false);
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
      setSelectedExternalEvent({ title: info.event.title, start: info.event.startStr, end: info.event.endStr, ...props });
      return;
    }

    if (props.type === "admin_block") {
      setSelectedExternalEvent({ title: info.event.title, start: info.event.startStr, end: info.event.endStr, ...props });
    }
  }

  async function handleDateSelect(selectionInfo) {
    const reason = window.prompt(
      `Motif du blocage :\n\nDu ${formatDate(selectionInfo.startStr)} au ${formatDate(selectionInfo.endStr)}`,
      "Résa perso"
    );

    if (reason === null) return;

    const { error } = await supabase.from("calendar_blocks").insert([
      {
        title: reason || "Blocage admin",
        start_date: selectionInfo.startStr,
        end_date: selectionInfo.endStr,
        notes: reason || null,
        source: "admin",
        status: "blocked",
      },
    ]);

    if (error) return alert("Erreur lors du blocage : " + error.message);
    await loadCalendar();
  }

  async function deleteBlock(blockId) {
    if (!window.confirm("Supprimer ce blocage admin ?")) return;
    const { error } = await supabase.from("calendar_blocks").delete().eq("id", blockId);
    if (error) return alert("Erreur suppression : " + error.message);
    setSelectedExternalEvent(null);
    await loadCalendar();
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
      </div>

      {loading && <p>Chargement du calendrier...</p>}

      <div style={styles.layout}>
        <div style={styles.calendar}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            height="auto"
            events={events}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            eventClick={openEvent}
          />
        </div>

        <aside style={styles.sidePanel}>
          {!selectedExternalEvent ? (
            <div>
              <h3>Fiche calendrier</h3>
              <p style={styles.muted}>Clique sur une réservation directe pour ouvrir la fiche résa centrale.</p>
              <p style={styles.muted}>Clique sur Airbnb/Booking pour renseigner les infos client.</p>
            </div>
          ) : (
            <EventPanel
              event={selectedExternalEvent}
              clientForm={clientForm}
              setClientForm={setClientForm}
              onSaveExternal={saveExternalClient}
              onDeleteBlock={deleteBlock}
            />
          )}
        </aside>
      </div>

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
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)", gap: "20px", alignItems: "start" },
  calendar: { minWidth: 0 },
  sidePanel: { background: "#f8fafc", borderRadius: "20px", padding: "18px", position: "sticky", top: "20px" },
  muted: { color: "#64748b", margin: "4px 0" },
  formGrid: { display: "grid", gap: "10px", margin: "16px 0" },
  input: { padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", fontSize: "14px" },
  textarea: { padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", fontSize: "14px", minHeight: "100px", resize: "vertical" },
  primaryButton: { border: "none", borderRadius: "999px", padding: "10px 14px", background: "#2f4f35", color: "white", cursor: "pointer", fontWeight: 700 },
  deleteButton: { border: "none", borderRadius: "999px", background: "#dc2626", color: "white", padding: "10px 14px", cursor: "pointer" },
  blockList: { marginTop: "28px" },
  blockItem: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "14px", marginBottom: "10px" },
};
