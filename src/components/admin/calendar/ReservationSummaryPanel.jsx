import { styles } from "./calendarStyles";
import { formatDate, nightsBetween } from "./calendarHelpers";

function getReservationName(reservation = {}) {
  return (
    [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ") ||
    reservation.display_name ||
    reservation.title ||
    "Réservation"
  );
}

function getReservationDates(reservation = {}) {
  const start = String(reservation.start_date || reservation.start || "").slice(0, 10);
  const end = String(reservation.end_date || reservation.end || "").slice(0, 10);
  return { start, end };
}

function getNightLabel(start, end) {
  const count = nightsBetween(start, end).length;
  if (!count) return "";
  return count === 1 ? "1 nuit" : `${count} nuits`;
}

function getAdultsChildren(reservation = {}) {
  const adults = reservation.adults_count ?? reservation.adults ?? "";
  const children = reservation.children_count ?? reservation.children ?? "";
  const parts = [];

  if (adults !== "" && adults !== null && adults !== undefined) {
    parts.push(`${adults} adulte${Number(adults) > 1 ? "s" : ""}`);
  }
  if (children !== "" && children !== null && children !== undefined && Number(children) !== 0) {
    parts.push(`${children} enfant${Number(children) > 1 ? "s" : ""}`);
  }

  return parts.join(" · ");
}

function compactButtonStyle(kind = "neutral") {
  const base = {
    border: "none",
    borderRadius: "999px",
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 800,
  };

  if (kind === "primary") return { ...base, background: "#2f4f35", color: "white" };
  return { ...base, background: "#e2e8f0", color: "#334155" };
}

export default function ReservationSummaryPanel({
  reservation,
  onEmail,
  onPhone,
  onSms,
  onOpenFull,
}) {
  if (!reservation) return null;

  const name = getReservationName(reservation);
  const { start, end } = getReservationDates(reservation);
  const nightLabel = getNightLabel(start, end);
  const phone = reservation.guest_phone || reservation.phone || "";
  const email = reservation.guest_email || reservation.email || "";
  const occupancy = getAdultsChildren(reservation);
  const arrivalTime = reservation.arrival_time || reservation.arrivalTime || "";
  const ownerHistoricalValue = reservation.owner_message || "";
  const housekeepingNotes = reservation.housekeeping_notes || "";
  const babyBedNeeded = Boolean(reservation.baby_bed_needed || reservation.babyBedNeeded);

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <div>
        <h3 style={{ marginBottom: "6px" }}>{name}</h3>
        <p style={styles.muted}>{formatDate(start)} → {formatDate(end)}</p>
        {nightLabel && <p style={styles.muted}>{nightLabel}</p>}
      </div>

      {(phone || email) && (
        <div style={{ display: "grid", gap: "8px" }}>
          {phone && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <span>📞 {phone}</span>
              <button type="button" style={compactButtonStyle()} onClick={() => onPhone?.(phone)}>Appeler</button>
              <button type="button" style={compactButtonStyle()} onClick={() => onSms?.(phone)}>SMS</button>
            </div>
          )}
          {email && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <span>✉ {email}</span>
              <button type="button" style={compactButtonStyle()} onClick={() => onEmail?.(email)}>Email</button>
            </div>
          )}
        </div>
      )}

      {(occupancy || babyBedNeeded || arrivalTime) && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
          {occupancy && <p style={styles.muted}>{occupancy}</p>}
          {babyBedNeeded && <p style={styles.muted}>Lit bébé demandé</p>}
          {arrivalTime && <p style={styles.muted}>Arrivée : {arrivalTime}</p>}
        </div>
      )}

      {ownerHistoricalValue && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "12px" }}>
          <strong>Valeur historique propriétaire — provenance non qualifiée</strong>
          <p style={{ ...styles.muted, marginTop: "6px", whiteSpace: "pre-wrap" }}>{ownerHistoricalValue}</p>
        </div>
      )}

      {housekeepingNotes && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "12px" }}>
          <strong>Note du propriétaire destinée au ménage</strong>
          <p style={{ ...styles.muted, marginTop: "6px", whiteSpace: "pre-wrap" }}>{housekeepingNotes}</p>
        </div>
      )}

      {onOpenFull && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
          <button type="button" style={compactButtonStyle("primary")} onClick={onOpenFull}>
            Voir la fiche complète
          </button>
        </div>
      )}
    </div>
  );
}
