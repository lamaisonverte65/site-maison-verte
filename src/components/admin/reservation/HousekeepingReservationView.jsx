import { useEffect, useState } from "react";
import { supabase } from "../../../supabaseClient";
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

const textareaStyle = {
  ...styles.largeTextarea,
  width: "100%",
  minHeight: "130px",
  boxSizing: "border-box",
  background: "white",
};

function ReadOnlyNoteBox({ title, children }) {
  return (
    <section style={styles.noteBox}>
      <strong>{title}</strong>
      <p>{children || "Aucune information."}</p>
    </section>
  );
}

export default function HousekeepingReservationView({ reservation, onEmail, onPhone, onSms, onReservationUpdated }) {
  const customer = reservation.customerSummary || {};
  const phone = customer.phone || reservation.guest_phone || "";
  const email = customer.email || reservation.guest_email || "";
  const firstName = customer.firstName || reservation.guest_first_name || "-";
  const lastName = customer.lastName || reservation.guest_last_name || "-";
  const adults = reservation.occupancy?.adults ?? reservation.adults_count ?? "-";
  const children = reservation.occupancy?.children ?? reservation.children_count ?? "-";
  const babyBed = reservation.occupancy?.babyBedNeeded ?? reservation.baby_bed_needed;
  const arrival = reservation.stay?.arrivalTime || reservation.arrival_time || "Non renseignée";
  const adminNotes = [reservation.housekeeping_notes, reservation.owner_message].filter(Boolean).join("\n\n");
  const clientMessage = reservation.message || "";
  const initialUserNotes = reservation.housekeeping_user_notes || reservation.housekeepingUserNotes || "";
  const isExternalOnlyReservation = Boolean(reservation.is_external_reservation && reservation.uid);
  const canSaveUserNotes = isExternalOnlyReservation ? Boolean(reservation.uid) : Boolean(reservation?.id);
  const [userNotes, setUserNotes] = useState(initialUserNotes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState("");

  useEffect(() => {
    setUserNotes(initialUserNotes);
    setNotesMessage("");
  }, [reservation.id, reservation.uid, initialUserNotes]);

  async function getAdminFetchHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  async function saveUserNotes() {
    if (!canSaveUserNotes) {
      setNotesMessage("Cette réservation n’est pas encore enregistrée dans la base : note utilisateur impossible à sauvegarder.");
      return;
    }

    try {
      setSavingNotes(true);
      setNotesMessage("");

      const endpoint = isExternalOnlyReservation
        ? "/.netlify/functions/update-external-reservation-client"
        : "/.netlify/functions/update-booking-request";

      const payload = isExternalOnlyReservation
        ? {
            updateMode: "housekeeping_user_notes",
            uid: reservation.uid,
            source: reservation.source,
            startDate: reservation.start_date,
            endDate: reservation.end_date,
            housekeepingUserNotes: userNotes,
          }
        : {
            bookingId: reservation.id,
            updateMode: "housekeeping_user_notes",
            housekeepingUserNotes: userNotes,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: await getAdminFetchHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Erreur enregistrement note utilisateur.");

      setNotesMessage("Note utilisateur enregistrée.");
      await onReservationUpdated?.();
    } catch (error) {
      setNotesMessage("Erreur : " + error.message);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div style={styles.reservationSheet}>
      <div style={styles.detailHeader}>
        <div>
          <p style={styles.kicker}>Fiche séjour ménage</p>
          <h3 style={styles.detailTitle}>{customer.fullName || reservation.displayName || "Séjour"}</h3>
          <p style={styles.muted}>{reservation.sourceLabel || reservation.source || "-"} · {formatDateValue(reservation.start_date)} → {formatDateValue(reservation.end_date)}</p>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <section style={styles.card}>
          <h3 style={styles.subTitle}>Client</h3>
          <div style={styles.detailGrid}>
            <HousekeepingInfo label="Nom" value={lastName} />
            <HousekeepingInfo label="Prénom" value={firstName} />
            <HousekeepingInfo label="Téléphone" value={phone || "-"} />
            <HousekeepingInfo label="Email" value={email || "-"} />
          </div>
          <div style={styles.contactButtons}>
            {phone && <button style={styles.smallButton} onClick={() => onPhone?.(phone)}>Téléphoner</button>}
            {phone && <button style={styles.smallButton} onClick={() => onSms?.(phone)}>SMS</button>}
            {email && <button style={styles.smallButton} onClick={() => onEmail?.(email)}>Email</button>}
          </div>
        </section>

        <section style={styles.card}>
          <h3 style={styles.subTitle}>Séjour</h3>
          <div style={styles.detailGrid}>
            <HousekeepingInfo label="Arrivée" value={formatDateValue(reservation.start_date)} />
            <HousekeepingInfo label="Départ" value={formatDateValue(reservation.end_date)} />
            <HousekeepingInfo label="Heure d'arrivée" value={arrival} />
            <HousekeepingInfo label="Adultes" value={adults} />
            <HousekeepingInfo label="Enfants" value={children} />
            <HousekeepingInfo label="Lit bébé" value={formatBool(babyBed)} />
          </div>
        </section>
      </div>

      <ReadOnlyNoteBox title="Messages clients">
        {clientMessage}
      </ReadOnlyNoteBox>

      <ReadOnlyNoteBox title="Notes admin">
        {adminNotes}
      </ReadOnlyNoteBox>

      <section style={styles.card}>
        <h3 style={styles.subTitle}>Note utilisateur</h3>
        <p style={styles.muted}>Zone modifiable par l’utilisateur ménage pour ajouter ses informations personnelles de suivi.</p>
        <textarea
          style={textareaStyle}
          value={userNotes}
          placeholder="Exemples : ampoule à remplacer, linge manquant, objet oublié, consigne pour le prochain passage..."
          disabled={!canSaveUserNotes}
          onChange={(event) => {
            setUserNotes(event.target.value);
            setNotesMessage("");
          }}
        />
        {notesMessage && (
          <p style={notesMessage.startsWith("Erreur") ? styles.error : styles.info}>{notesMessage}</p>
        )}
        <div style={{ ...styles.contactButtons, marginTop: "10px" }}>
          <button type="button" style={styles.addButton} onClick={saveUserNotes} disabled={savingNotes || !canSaveUserNotes}>
            {savingNotes ? "Enregistrement..." : "Enregistrer la note utilisateur"}
          </button>
        </div>
      </section>
    </div>
  );
}
