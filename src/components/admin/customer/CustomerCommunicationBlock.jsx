import { styles } from "../adminStyles";

export default function CustomerCommunicationBlock({ profile, onOpenCommunication }) {
  return (
    <section style={{ ...styles.card, marginTop: "22px" }}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Communication client</h3>
          <p style={styles.muted}>Accès aux échanges liés au client et à ses réservations.</p>
        </div>
        {onOpenCommunication && (
          <button
            style={styles.smallButton}
            onClick={() => onOpenCommunication({ type: "customer", customer: profile.customer })}
          >
            Ouvrir communication
          </button>
        )}
      </div>
      <div style={styles.detailGrid}>
        <div style={styles.infoItem}><span>Contact disponible</span><strong>{profile.hasContact ? "Oui" : "Non"}</strong></div>
        <div style={styles.infoItem}><span>Opt-in marketing</span><strong>{profile.marketingConsent ? "Oui" : "Non"}</strong></div>
        <div style={styles.infoItem}><span>Messages réservation repérés</span><strong>{profile.communicationCount}</strong></div>
        <div style={styles.infoItem}><span>Client fidèle</span><strong>{profile.isLoyal ? "Oui" : "Non"}</strong></div>
      </div>
    </section>
  );
}
