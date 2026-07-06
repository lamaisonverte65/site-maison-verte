import { styles } from "./calendarStyles";
import { formatDate } from "./calendarHelpers";
import ReservationPeriodEditor from "./ReservationPeriodEditor";

export default function EventPanel({ event, onDeleteBlock, onApplyExternalAction }) {
  if (event.type === "external_import") {
    return (
      <ReservationPeriodEditor
        key={event.uid || event.id || `${event.source || "external"}-${event.start_date || event.start}-${event.end_date || event.end}`}
        event={event}
        onApplyExternalAction={onApplyExternalAction}
      />
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
