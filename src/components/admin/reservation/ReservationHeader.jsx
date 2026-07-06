import { styles } from "../adminStyles";
import { StatusBadge } from "../AdminUi";
import { formatDateTime, getRequestName, shortId } from "../../../utils/adminFormatters";

export default function ReservationHeader({ request, status }) {
  return (
    <div style={styles.detailHeader}>
      <div>
        <h3 style={styles.detailTitle}>{getRequestName(request)}</h3>
        <p style={styles.muted}>Réservation n° {shortId(request.id)} · créée le {formatDateTime(request.created_at)}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}
