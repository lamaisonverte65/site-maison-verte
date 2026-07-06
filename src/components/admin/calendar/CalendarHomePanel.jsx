import { styles } from "./calendarStyles";
import { buildExternalReservation, formatDate, formatLocalDate } from "./calendarHelpers";

function getTodaySummary(events = []) {
  const today = formatLocalDate(new Date());
  const stays = events
    .filter((event) => ["external", "booking_request"].includes(event.extendedProps?.type))
    .map((event) => {
      const reservation = event.extendedProps?.type === "external"
        ? buildExternalReservation(event.extendedProps, event.title)
        : event.extendedProps?.reservation;
      return { event, reservation };
    })
    .filter(({ reservation }) => reservation?.start_date && reservation?.end_date)
    .sort((a, b) => String(a.reservation.start_date).localeCompare(String(b.reservation.start_date)));

  const arrivals = stays.filter(({ reservation }) => String(reservation.start_date).slice(0, 10) === today);
  const departures = stays.filter(({ reservation }) => String(reservation.end_date).slice(0, 10) === today);
  const current = stays.find(({ reservation }) => String(reservation.start_date).slice(0, 10) <= today && String(reservation.end_date).slice(0, 10) > today);
  const next = stays.find(({ reservation }) => String(reservation.start_date).slice(0, 10) > today);

  return { today, arrivals, departures, current, next };
}

export default function CalendarHomePanel({ events = [], mode = "admin", onOpenReservation, onStartBlock }) {
  const summary = getTodaySummary(events);
  const currentName = summary.current?.reservation?.displayName || summary.current?.event?.title || "-";
  const nextReservation = summary.next?.reservation;
  const nextName = nextReservation?.displayName || summary.next?.event?.title || "-";
  const nextDate = nextReservation?.start_date ? formatDate(nextReservation.start_date) : "-";

  return (
    <div>
      <h3>{mode === "housekeeping" ? "Planning ménage" : "Aujourd'hui"}</h3>
      <div style={styles.infoPanelGrid}>
        <div style={styles.infoBox}>
          <span>Maison occupée</span>
          <strong>{summary.current ? "Oui" : "Non"}</strong>
        </div>
        <div style={styles.infoBox}>
          <span>Arrivées aujourd'hui</span>
          <strong>{summary.arrivals.length}</strong>
        </div>
        <div style={styles.infoBox}>
          <span>Départs aujourd'hui</span>
          <strong>{summary.departures.length}</strong>
        </div>
      </div>

      <section style={styles.infoSection}>
        <h4>Occupation</h4>
        <p style={styles.muted}>{currentName}</p>
      </section>

      <section style={styles.infoSection}>
        <h4>Prochain séjour</h4>
        <p style={styles.muted}>{nextName}</p>
        <p style={styles.muted}>{nextDate}</p>
        {nextReservation && (
          <button style={styles.smallButton} onClick={() => onOpenReservation?.(nextReservation)}>
            Voir la prochaine réservation
          </button>
        )}
      </section>

      {mode !== "housekeeping" && (
        <section style={styles.infoSection}>
          <h4>Actions rapides</h4>
          <p style={styles.muted}>Clique une date de début puis une date de fin pour bloquer des dates ou créer une réservation personnelle.</p>
          <button style={styles.smallButton} onClick={onStartBlock}>Sélectionner une période</button>
        </section>
      )}
    </div>
  );
}
