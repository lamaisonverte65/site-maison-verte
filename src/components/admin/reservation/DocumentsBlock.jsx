import { styles } from "../adminStyles";
import { Info } from "../AdminUi";
import { formatDateTime } from "../../../utils/adminFormatters";

export default function DocumentsBlock({ request }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={styles.subTitle}>Documents</h3>
      <div style={styles.detailGrid}>
        <Info label="Contrat accepté" value={request.contract_accepted ? `Oui — ${formatDateTime(request.contract_accepted_at)}` : "Non / non renseigné"} />
        <Info label="Version contrat" value={request.contract_version || "-"} />
        <Info label="Livret / arrivée" value={request.arrival_email_sent_at ? `Envoyé — ${formatDateTime(request.arrival_email_sent_at)}` : "Non renseigné"} />
        <Info label="Avis demandé" value={formatDateTime(request.review_requested_at)} />
        {request.contract_url && (
          <div style={styles.infoItem}>
            <span>Contrat</span>
            <a href={request.contract_url} target="_blank" rel="noreferrer">Voir le PDF</a>
          </div>
        )}
      </div>
    </section>
  );
}
