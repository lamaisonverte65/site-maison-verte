import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "../supabaseClient";

export default function CalendarAdmin() {
  const [events, setEvents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [blockTitle, setBlockTitle] = useState("Blocage admin");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockNotes, setBlockNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setLoading(true);

    const calendarResponse = await fetch("/.netlify/functions/calendar");
    const calendarData = await calendarResponse.json();

    const { data: externalClientLinks } = await supabase
      .from("external_reservation_clients")
      .select("*");

    const externalEvents = (calendarData.externalReservations || []).map(
      (reservation) => {
        const linkedClient = (externalClientLinks || []).find(
          (item) => item.uid === reservation.uid
        );

        const clientName = linkedClient
          ? [linkedClient.guest_first_name, linkedClient.guest_last_name]
              .filter(Boolean)
              .join(" ")
          : "";

        const sourceLabel =
          reservation.source === "airbnb" ? "Airbnb" : "Booking";

        return {
          id: reservation.uid,
          title: clientName ? `${sourceLabel} - ${clientName}` : sourceLabel,
          start: reservation.start_date,
          end: reservation.end_date,
          backgroundColor:
            reservation.source === "airbnb" ? "#ff5a5f" : "#003580",
          borderColor:
            reservation.source === "airbnb" ? "#ff5a5f" : "#003580",
          extendedProps: {
            type: "external",
            source: reservation.source,
            status: "externe",
            uid: reservation.uid,
            start_date: reservation.start_date,
            end_date: reservation.end_date,
            linkedClient,
          },
        };
      }
    );

    const { data: bookingRequests } = await supabase
      .from("booking_requests")
      .select("*");

    const directEvents = (bookingRequests || []).map((reservation) => ({
      title:
        reservation.status === "pending"
          ? "Demande directe"
          : reservation.guest_first_name || "Client direct",
      start: reservation.start_date,
      end: reservation.end_date,
      backgroundColor:
        reservation.status === "pending" ? "#f59e0b" : "#16a34a",
      borderColor:
        reservation.status === "pending" ? "#f59e0b" : "#16a34a",
      extendedProps: {
        type: "booking_request",
        source: "website",
        status: reservation.status,
        email: reservation.guest_email,
        phone: reservation.guest_phone,
      },
    }));

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
      backgroundColor: "#7c3aed",
      borderColor: "#7c3aed",
      extendedProps: {
        type: "admin_block",
        source: block.source,
        status: block.status,
        notes: block.notes,
        blockId: block.id,
      },
    }));

    setEvents([...externalEvents, ...directEvents, ...blockEvents]);
    setLoading(false);
  }

  async function createOrUpdateCustomer({
    firstName,
    lastName,
    email,
    phone,
    source,
    notes,
  }) {
    let existingCustomer = null;

    if (email) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      existingCustomer = data;
    }

    if (!existingCustomer && phone) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", phone)
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
          last_stay: new Date().toISOString().split("T")[0],
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
          first_stay: new Date().toISOString().split("T")[0],
          last_stay: new Date().toISOString().split("T")[0],
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function editExternalReservation(props) {
    const existing = props.linkedClient || {};

    const firstName = window.prompt(
      "Prénom du client :",
      existing.guest_first_name || ""
    );
    if (firstName === null) return;

    const lastName = window.prompt(
      "Nom du client :",
      existing.guest_last_name || ""
    );
    if (lastName === null) return;

    const phone = window.prompt(
      "Téléphone du client :",
      existing.guest_phone || ""
    );
    if (phone === null) return;

    const email = window.prompt(
      "Email du client :",
      existing.guest_email || ""
    );
    if (email === null) return;

    const notes = window.prompt(
      "Notes internes :",
      existing.notes || props.source
    );
    if (notes === null) return;

    try {
      const customer = await createOrUpdateCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source: props.source,
        notes: notes.trim(),
      });

      const { error } = await supabase
        .from("external_reservation_clients")
        .upsert(
          {
            uid: props.uid,
            source: props.source,
            start_date: props.start_date,
            end_date: props.end_date,
            customer_id: customer.id,
            guest_first_name: firstName.trim() || null,
            guest_last_name: lastName.trim() || null,
            guest_email: email.trim() || null,
            guest_phone: phone.trim() || null,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "uid" }
        );

      if (error) throw error;

      alert("Client enregistré et lié à la réservation externe.");
      await loadCalendar();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function createBlock(event) {
    event.preventDefault();
    await saveBlock();
  }

  async function saveBlock() {
    if (!blockStart || !blockEnd) {
      alert("Choisis une date de début et une date de fin.");
      return;
    }

    if (blockEnd <= blockStart) {
      alert("La date de fin doit être après la date de début.");
      return;
    }

    const { error } = await supabase.from("calendar_blocks").insert([
      {
        title: blockTitle || "Blocage admin",
        start_date: blockStart,
        end_date: blockEnd,
        notes: blockNotes || null,
        source: "admin",
        status: "blocked",
      },
    ]);

    if (error) {
      alert("Erreur lors du blocage : " + error.message);
      return;
    }

    setBlockTitle("Blocage admin");
    setBlockStart("");
    setBlockEnd("");
    setBlockNotes("");

    await loadCalendar();
  }

  async function handleDateSelect(selectionInfo) {
    const start = selectionInfo.startStr;
    const end = selectionInfo.endStr;

    setBlockStart(start);
    setBlockEnd(end);

    const reason = window.prompt(
      `Motif du blocage :\n\nDu ${formatDate(start)} au ${formatDate(end)}`,
      blockNotes || "Résa perso"
    );

    if (reason === null) return;

    const { error } = await supabase.from("calendar_blocks").insert([
      {
        title: reason || "Blocage admin",
        start_date: start,
        end_date: end,
        notes: reason || null,
        source: "admin",
        status: "blocked",
      },
    ]);

    if (error) {
      alert("Erreur lors du blocage : " + error.message);
      return;
    }

    setBlockTitle("Blocage admin");
    setBlockStart("");
    setBlockEnd("");
    setBlockNotes("");

    await loadCalendar();
  }

  async function deleteBlock(blockId) {
    const confirmDelete = window.confirm(
      "Supprimer ce blocage admin ? Les dates redeviendront disponibles."
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("calendar_blocks")
      .delete()
      .eq("id", blockId);

    if (error) {
      alert("Erreur suppression : " + error.message);
      return;
    }

    await loadCalendar();
  }

  function handleEventClick(info) {
    const props = info.event.extendedProps;

    if (props.type === "external") {
      editExternalReservation(props);
      return;
    }

    if (props.type === "admin_block") {
      const deleteThis = window.confirm(
        `Blocage admin\n\n` +
          `Titre : ${info.event.title}\n` +
          `Statut : ${props.status}\n` +
          `Notes : ${props.notes || "aucune"}\n\n` +
          `Supprimer ce blocage ?`
      );

      if (deleteThis) {
        deleteBlock(props.blockId);
      }

      return;
    }

    alert(
      `Source : ${props.source}\n\n` +
        `Statut : ${props.status || "externe"}\n\n` +
        `Email : ${props.email || "non disponible"}\n\n` +
        `Téléphone : ${props.phone || "non disponible"}`
    );
  }

  return (
    <div style={styles.wrapper}>
      <form style={styles.form} onSubmit={createBlock}>
        <h3 style={styles.formTitle}>Bloquer des dates</h3>

        <p style={styles.help}>
          Astuce : tu peux sélectionner directement une période dans le calendrier.
          Tu peux aussi cliquer sur une réservation Airbnb/Booking pour renseigner
          le client.
        </p>

        <div style={styles.formGrid}>
          <input
            style={styles.input}
            value={blockTitle}
            onChange={(event) => setBlockTitle(event.target.value)}
            placeholder="Titre du blocage"
          />

          <input
            style={styles.input}
            type="date"
            value={blockStart}
            onChange={(event) => setBlockStart(event.target.value)}
          />

          <input
            style={styles.input}
            type="date"
            value={blockEnd}
            onChange={(event) => setBlockEnd(event.target.value)}
          />

          <input
            style={styles.input}
            value={blockNotes}
            onChange={(event) => setBlockNotes(event.target.value)}
            placeholder="Notes internes"
          />

          <button style={styles.button} type="submit">
            Bloquer
          </button>
        </div>
      </form>

      <div style={styles.legend}>
        <Legend color="#ff5a5f" label="Airbnb" />
        <Legend color="#003580" label="Booking" />
        <Legend color="#f59e0b" label="Demande en attente" />
        <Legend color="#16a34a" label="Réservation directe" />
        <Legend color="#7c3aed" label="Blocage admin" />
      </div>

      {loading && <p>Chargement du calendrier...</p>}

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="fr"
        height="auto"
        events={events}
        selectable={true}
        selectMirror={true}
        select={handleDateSelect}
        eventClick={handleEventClick}
      />

      <section style={styles.blockList}>
        <h3>Blocages admin</h3>

        {blocks.length === 0 ? (
          <p style={styles.empty}>Aucun blocage admin enregistré.</p>
        ) : (
          blocks.map((block) => (
            <div key={block.id} style={styles.blockItem}>
              <div>
                <strong>{block.title || "Blocage admin"}</strong>
                <p style={styles.muted}>
                  {formatDate(block.start_date)} → {formatDate(block.end_date)}
                </p>
                {block.notes && <p style={styles.muted}>{block.notes}</p>}
              </div>

              <button
                style={styles.deleteButton}
                onClick={() => deleteBlock(block.id)}
              >
                Supprimer
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={styles.legendItem}>
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "999px",
          background: color,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

const styles = {
  wrapper: {
    background: "white",
    borderRadius: "24px",
    padding: "20px",
  },
  form: {
    background: "#f8fafc",
    borderRadius: "20px",
    padding: "18px",
    marginBottom: "20px",
  },
  formTitle: {
    marginTop: 0,
    marginBottom: "8px",
  },
  help: {
    marginTop: 0,
    marginBottom: "14px",
    color: "#64748b",
    fontSize: "14px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  input: {
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
  },
  button: {
    border: "none",
    borderRadius: "14px",
    background: "#2f4f35",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    padding: "12px 16px",
  },
  legend: {
    display: "flex",
    gap: "18px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  blockList: {
    marginTop: "28px",
  },
  blockItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "10px",
  },
  muted: {
    color: "#64748b",
    margin: "4px 0",
  },
  empty: {
    color: "#64748b",
  },
  deleteButton: {
    border: "none",
    borderRadius: "999px",
    background: "#dc2626",
    color: "white",
    padding: "10px 14px",
    cursor: "pointer",
  },
};