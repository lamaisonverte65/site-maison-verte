import { useState } from "react";
import { styles } from "./adminStyles";

const STATUS_LABELS = {
  pending: "À confirmer",
  accepted: "Acceptée",
  deposit_paid: "Acompte payé",
  paid: "Payée",
  fully_paid: "Séjour soldé",
  confirmed: "Confirmée",
  refused: "Refusée",
  cancelled: "Annulée",
  expired: "Expirée",
};

const STATUS_COLORS = {
  pending: "#f59e0b",
  accepted: "#f97316",
  deposit_paid: "#2563eb",
  paid: "#14532d",
  fully_paid: "#052e16",
  confirmed: "#15803d",
  refused: "#dc2626",
  cancelled: "#6b7280",
  expired: "#7f1d1d",
};

export function HistorySection({ title, empty, items, renderItem }) {
  return (
    <div style={styles.historyBox}>
      <h3 style={styles.subTitle}>{title}</h3>
      {!items || items.length === 0 ? (
        <p style={styles.empty}>{empty}</p>
      ) : (
        <div style={styles.historyList}>
          {items.map((item) => (
            <div key={item.id} style={styles.historyItem}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionModal({ modal, onClose, onSubmit }) {
  const [price, setPrice] = useState(modal.price || "");
  const [reason, setReason] = useState(modal.reason || "solde");
  const [message, setMessage] = useState(modal.message || "");
  const [refundMode, setRefundMode] = useState(modal.refundMode || "none");
  const [refundAmount, setRefundAmount] = useState(modal.refundAmount || "");
  const [cancellationType, setCancellationType] = useState(modal.cancellationType || "client");
  const [confirmed, setConfirmed] = useState(false);

  function submit(event) {
    event.preventDefault();
    onSubmit({ price, reason, message, refundMode, refundAmount, cancellationType, confirmed });
  }

  return (
    <div style={styles.modalOverlay}>
      <form style={styles.modal} onSubmit={submit}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0 }}>{modal.title}</h2>
          <button type="button" style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <p style={styles.empty}>{modal.helper}</p>

        {modal.type === "accept" && (
          <label style={styles.label}>Tarif proposé (€)<input style={styles.input} value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        )}

        {modal.type === "manual_payment" && (
          <>
            <label style={styles.label}>Montant à payer (€)<input style={styles.input} value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ex : 168" /></label>
            <label style={styles.label}>Motif du paiement<select style={styles.input} value={reason} onChange={(event) => setReason(event.target.value)}><option value="solde">Solde</option><option value="acompte">Acompte</option><option value="total">Paiement total / tarif promo</option><option value="complement">Complément</option></select></label>
          </>
        )}

        <label style={styles.label}>Message envoyé au client / note interne<textarea style={styles.largeTextarea} value={message} onChange={(event) => setMessage(event.target.value)} /></label>

        {(modal.type === "cancel" || modal.type === "refund_only") && (
          <>
            {modal.type === "cancel" && (
              <label style={styles.label}>
                Type d’annulation
                <select style={styles.input} value={cancellationType} onChange={(event) => setCancellationType(event.target.value)}>
                  <option value="client">Annulation client</option>
                  <option value="owner">Annulation propriétaire</option>
                </select>
              </label>
            )}

            <label style={styles.label}>
              Remboursement
              <select style={styles.input} value={refundMode} onChange={(event) => setRefundMode(event.target.value)}>
                {modal.type === "cancel" && <option value="policy">Calculer selon les conditions</option>}
                {modal.type === "cancel" && <option value="none">Aucun remboursement</option>}
                <option value="deposit">Rembourser l’acompte</option>
                <option value="balance">Rembourser le solde</option>
                <option value="total">Remboursement total</option>
                <option value="custom">Montant libre</option>
              </select>
            </label>

            {refundMode === "custom" && (
              <label style={styles.label}>
                Montant à rembourser (€)
                <input style={styles.input} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Ex : 72" />
              </label>
            )}
          </>
        )}

        <label style={styles.securityBox}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{modal.confirmText || "Je confirme cette action."}</span></label>

        <div style={styles.modalActions}>
          <button type="button" style={styles.cancelButton} onClick={onClose}>Retour</button>
          <button type="submit" style={styles.acceptButton}>Valider</button>
        </div>
      </form>
    </div>
  );
}

export function MiniBarChart({ title, rows, emptyLabel = "Aucune donnée" }) {
  const cleanRows = (rows || []).filter(([label]) => label !== undefined && label !== null && String(label).trim() !== "");
  const max = Math.max(1, ...cleanRows.map(([, count]) => Number(count || 0)));

  return (
    <div style={styles.chartBox}>
      <strong>{title}</strong>
      {cleanRows.length === 0 ? (
        <p style={styles.muted}>{emptyLabel}.</p>
      ) : (
        <div style={styles.chartRows}>
          {cleanRows.map(([label, count]) => {
            const value = Number(count || 0);
            const width = `${Math.max(4, Math.round((value / max) * 100))}%`;
            return (
              <div key={String(label)} style={styles.chartRow}>
                <div style={styles.chartLabel} title={String(label)}>{String(label)}</div>
                <div style={styles.chartTrack}>
                  <div style={{ ...styles.chartBar, width }} />
                </div>
                <strong style={styles.chartValue}>{value}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SummaryList({ title, rows }) {
  return (
    <div style={styles.summaryBox}>
      <strong>{title}</strong>
      {rows.length === 0 ? <p style={styles.muted}>Aucune donnée.</p> : rows.map(([label, count]) => (
        <p key={label} style={styles.summaryRow}><span>{label}</span><strong>{count}</strong></p>
      ))}
    </div>
  );
}

export function StatCard({ label, value, onClick }) { return <button style={styles.statCard} onClick={onClick}><span style={styles.statLabel}>{label}</span><strong style={styles.statValue}>{value}</strong></button>; }
export function StatusBadge({ status }) { return <span style={{ ...styles.badge, backgroundColor: STATUS_COLORS[status] || "#6b7280" }}>{STATUS_LABELS[status] || status}</span>; }
export function Info({ label, value }) { return <div style={styles.infoItem}><span>{label}</span><strong>{value || "-"}</strong></div>; }
export function SortableTh({ label, sortKey, sort, onSort }) { const active = sort.key === sortKey; const arrow = active ? (sort.direction === "asc" ? " ↑" : " ↓") : ""; return <th style={styles.th}><button style={styles.thButton} onClick={() => onSort(sortKey)}>{label}{arrow}</button></th>; }
export function EditableTd({ value, onClick }) { return <td style={styles.td} onClick={onClick} title="Cliquer pour modifier">{value || "-"}</td>; }
