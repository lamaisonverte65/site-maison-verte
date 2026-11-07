import { styles } from "../adminStyles";
import { formatDate, formatMoney } from "../../../utils/adminFormatters";

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv(rows) {
  // Keep the historic Net Stripe in CSV column 8 for downstream imports/tests.
  const headers = ["Client", "Début", "Fin", "Statut", "CA confirmé", "Payé client", "Frais", "Net Stripe / plateforme", "Payouts", "Origine", "Référence plateforme"];
  const lines = rows.map((row) => [
    row.name,
    formatDate(row.startDate),
    formatDate(row.endDate),
    row.status,
    formatMoney(row.confirmedAmount),
    formatMoney(row.paidClientAmount),
    formatMoney(row.source === "booking" || row.source === "airbnb" ? row.platformFeeAmount : row.stripeFeeAmount),
    (row.source === "booking" || row.source === "airbnb")
      ? (row.platformNetAmount == null ? "" : formatMoney(row.platformNetAmount))
      : row.stripeFinancialsComplete === true
        && row.stripeNetAmount !== null
        && row.stripeNetAmount !== undefined
        && row.stripeNetAmount !== ""
        && Number.isFinite(Number(row.stripeNetAmount))
          ? formatMoney(row.stripeNetAmount) : "",
    (row.payoutIds || []).join(", "),
    row.sourceLabel || "Site",
    row.externalReference || "",
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
    <div style={{ ...styles.headerActions, marginBottom: 0 }}>
      <button type="button" style={{ ...styles.smallButton, fontSize: 12, padding: "7px 10px" }} onClick={exportCsv}>Exporter CSV</button>
    </div>
  );
}
