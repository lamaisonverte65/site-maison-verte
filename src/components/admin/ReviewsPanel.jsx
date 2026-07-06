import { styles } from "./adminStyles";
import { formatDateTime } from "../../utils/adminFormatters";

export default function ReviewsPanel({
  guestReviews,
  onUpdateReviewStatus,
  onDeleteGuestReview,
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>Avis clients</h2>
        <p style={styles.muted}>Les avis sont publiés sur le site uniquement après validation.</p>
      </div>

      {guestReviews.length === 0 ? (
        <p style={styles.empty}>Aucun avis reçu pour le moment.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead style={styles.stickyHead}>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Note</th>
                <th style={styles.th}>Commentaire</th>
                <th style={styles.th}>Séjour</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {guestReviews.map((review) => (
                <tr key={review.id}>
                  <td style={styles.td}>{formatDateTime(review.created_at)}</td>
                  <td style={styles.td}>{review.display_name || [review.guest_first_name, review.guest_last_name].filter(Boolean).join(" ") || "Voyageur"}</td>
                  <td style={styles.td}>{"★".repeat(Number(review.rating || 0))}</td>
                  <td style={{ ...styles.td, maxWidth: "420px", whiteSpace: "normal", lineHeight: 1.5 }}>{review.comment}</td>
                  <td style={styles.td}>{review.stay_period || "-"}</td>
                  <td style={styles.td}>{review.status || "pending"}</td>
                  <td style={styles.td}>{review.guest_email || review.guest_phone || "-"}</td>
                  <td style={styles.td}>
                    <div style={styles.contactButtons}>
                      {review.status !== "published" && (
                        <button style={styles.acceptButton} onClick={() => onUpdateReviewStatus(review, "published")}>Publier</button>
                      )}
                      {review.status === "published" && (
                        <button style={styles.cancelButton} onClick={() => onUpdateReviewStatus(review, "hidden")}>Masquer</button>
                      )}
                      <button style={styles.deleteButton} onClick={() => onDeleteGuestReview(review)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
