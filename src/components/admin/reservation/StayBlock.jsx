import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import { formatDate } from "../../../utils/adminFormatters";

export default function StayBlock({ request }) {
  return (
    <>
      <h3 style={styles.subTitle}>Séjour</h3>
      <div style={styles.detailGrid}>
        <Info label="Arrivée" value={formatDate(request.start_date)} />
        <Info label="Départ" value={formatDate(request.end_date)} />
        <Info label="Nuits" value={request.nights} />
        <Info label="Heure d’arrivée" value={request.arrival_time || "à renseigner"} />
      </div>
    </>
  );
}
