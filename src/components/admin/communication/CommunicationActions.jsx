import { styles } from "../adminStyles";

function getTargetLabel(context, target) {
  if (context === "customer") return "Ouvrir la communication client";
  if (context === "reservation") return "Ouvrir la communication réservation";
  return "Ouvrir la communication";
}

export default function CommunicationActions({ context, target, onOpenCommunication, onEmail }) {
  if (!target && !onOpenCommunication && !onEmail) return null;

  return (
    <section style={{ marginTop: "22px" }}>
      <h3 style={styles.subTitle}>Communication</h3>
      <div style={styles.contactButtons}>
        {onOpenCommunication && (
          <button
            style={styles.smallButton}
            onClick={() => onOpenCommunication({ [context]: target })}
          >
            {getTargetLabel(context, target)}
          </button>
        )}
        {onEmail && (
          <button style={styles.smallButton} onClick={onEmail}>Email direct</button>
        )}
      </div>
    </section>
  );
}
