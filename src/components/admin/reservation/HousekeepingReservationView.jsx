import { useEffect, useState } from "react";
import { styles } from "../adminStyles";
import { displayValue, formatBool, formatDateValue } from "../../../utils/reservationUtils";

function HousekeepingInfo({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function ReadOnlyBox({ title, children }) {
  return (
    <section style={styles.noteBox}>
      <strong>{title}</strong>
      <p>{children || "Aucune information."}</p>
    </section>
  );
}

export default function HousekeepingReservationView({
  reservation,
  onEmail,
  onPhone,
  onSms,
  onCreateNote,
  onReservationUpdated,
}) {
  const guest = reservation.guest || {};
  const occupancy = reservation.occupancy || {};
  const stay = reservation.stay || {};
  const communications = reservation.communications || {};
  const internalNotes = reservation.internalNotes || {};
  const notes = Array.isArray(internalNotes.housekeeping) ? internalNotes.housekeeping : [];
  const [housekeepingNote, setHousekeepingNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setHousekeepingNote("");
    setStatusMessage("");
  }, [reservation.id]);

  async function saveNote() {
    try {
      setSavingNote(true);
      setStatusMessage("");
      await onCreateNote?.(reservation.id, housekeepingNote);
      setHousekeepingNote("");
      setStatusMessage("Note ménage ajoutée.");
      await onReservationUpdated?.();
    } catch (error) {
      setStatusMessage(`Erreur : ${error.message}`);
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div style={styles.reservationSheet}>
      <div style={styles.detailHeader}>
        <div>
          <p style={styles.kicker}>Fiche séjour ménage</p>
          <h3 style={styles.detailTitle}>{[guest.firstName, guest.lastName].filter(Boolean).join(" ") || "Séjour"}</h3>
          <p style={styles.muted}>{formatDateValue(reservation.startDate)} → {formatDateValue(reservation.endDate)}</p>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <section style={styles.card}>
          <h3 style={styles.subTitle}>Client</h3>
          <div style={styles.detailGrid}>
            <HousekeepingInfo label="Nom" value={guest.lastName} />
            <HousekeepingInfo label="Prénom" value={guest.firstName} />
            <HousekeepingInfo label="Téléphone" value={guest.phone} />
            <HousekeepingInfo label="Email" value={guest.email} />
          </div>
          <div style={styles.contactButtons}>
            {guest.phone && <button style={styles.smallButton} onClick={() => onPhone?.(guest.phone)}>Téléphoner</button>}
            {guest.phone && <button style={styles.smallButton} onClick={() => onSms?.(guest.phone)}>SMS</button>}
            {guest.email && <button style={styles.smallButton} onClick={() => onEmail?.(guest.email)}>Email</button>}
          </div>
        </section>

        <section style={styles.card}>
          <h3 style={styles.subTitle}>Séjour</h3>
          <div style={styles.detailGrid}>
            <HousekeepingInfo label="Arrivée" value={formatDateValue(reservation.startDate)} />
            <HousekeepingInfo label="Départ" value={formatDateValue(reservation.endDate)} />
            <HousekeepingInfo label="Adultes" value={occupancy.adults} />
            <HousekeepingInfo label="Enfants" value={occupancy.children} />
            <HousekeepingInfo label="Âges enfants" value={occupancy.childrenAges} />
            <HousekeepingInfo label="Lit bébé" value={formatBool(occupancy.babyBedNeeded)} />
          </div>
        </section>
      </div>

      <section style={styles.card}>
        <h3 style={styles.subTitle}>Horaires opérationnels</h3>
        <div style={styles.detailGrid}>
          <HousekeepingInfo label="Heure d’arrivée" value={stay.arrivalTime} />
          <HousekeepingInfo label="Heure de départ particulière" value={stay.departureTime} />
        </div>
      </section>

      <ReadOnlyBox title="Informations pratiques du séjour">{stay.practicalInformation}</ReadOnlyBox>
      <ReadOnlyBox title="Message du client">{communications.clientMessage}</ReadOnlyBox>
      <ReadOnlyBox title="Note du propriétaire destinée au ménage">{internalNotes.ownerForHousekeeping}</ReadOnlyBox>

      <section style={styles.card}>
        <h3 style={styles.subTitle}>Notes opérationnelles du ménage</h3>
        {notes.length === 0 && <p style={styles.muted}>Aucune note ménage.</p>}
        {notes.map((note) => (
          <div key={note.id} style={styles.noteBox}>
            <strong>{note.authorDisplayName || "Compte ménage"}</strong>
            <p>{note.note}</p>
            <small style={styles.muted}>{note.createdAt ? new Date(note.createdAt).toLocaleString("fr-FR") : ""}</small>
          </div>
        ))}
        <h4>Ajouter une note</h4>
        <p style={styles.muted}>Cette note append-only reste interne et n’est jamais envoyée au client.</p>
        <textarea
          style={{ ...styles.largeTextarea, width: "100%", minHeight: "130px", boxSizing: "border-box" }}
          value={housekeepingNote}
          maxLength={2000}
          onChange={(event) => setHousekeepingNote(event.target.value)}
        />
        <button
          type="button"
          style={styles.addButton}
          disabled={savingNote || !housekeepingNote.trim()}
          onClick={saveNote}
        >Ajouter la note ménage</button>
      </section>

      {statusMessage && <p style={statusMessage.startsWith("Erreur") ? styles.error : styles.info}>{statusMessage}</p>}
    </div>
  );
}
