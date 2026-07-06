import { styles } from "../adminStyles";
import { formatDate, formatMoney } from "../../../utils/adminFormatters";

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv(rows) {
  const headers = ["Client", "Début", "Fin", "Statut", "CA confirmé", "Payé client", "Frais Stripe", "Net Stripe", "Payouts"];
  const lines = rows.map((row) => [
    row.name,
    formatDate(row.startDate),
    formatDate(row.endDate),
    row.status,
    formatMoney(row.confirmedAmount),
    formatMoney(row.paidClientAmount),
    formatMoney(row.stripeFeeAmount),
    row.stripeNetAmount ? formatMoney(row.stripeNetAmount) : "",
    (row.payoutIds || []).join(", "),
  ].map(csvEscape).join(";"));

  return [headers.map(csvEscape).join(";"), ...lines].join("\n");
}

export default function PaymentActions({ rows }) {
  function exportCsv() {
    const csv = buildCsv(rows || []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `paiements-la-maison-verte-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ ...styles.headerActions, marginBottom: 18 }}>
      <button style={styles.smallButton} onClick={exportCsv}>Exporter CSV</button>
    </div>
  );
}
