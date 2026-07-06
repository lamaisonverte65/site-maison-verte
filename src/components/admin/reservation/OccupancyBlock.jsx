import { styles } from "../adminStyles";
import { Info } from "../AdminUi";

export default function OccupancyBlock({ request }) {
  return (
    <>
      <h3 style={styles.subTitle}>Voyageurs</h3>
      <div style={styles.detailGrid}>
        <Info label="Adultes" value={request.adults_count ?? "-"} />
        <Info label="Enfants" value={request.children_count ?? "0"} />
        <Info label="Âge des enfants" value={request.children_ages || "-"} />
        <Info label="Lit bébé / bébé" value={request.baby_bed_needed ? "Oui" : "Non"} />
      </div>
    </>
  );
}
