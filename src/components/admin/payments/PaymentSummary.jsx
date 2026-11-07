import { styles } from "../adminStyles";
import { formatMoney } from "../../../utils/adminFormatters";

export default function PaymentSummary({ stats }) {
  const items = [
    ["CA site", formatMoney(stats.confirmedTotal)],
    ["Payé site", formatMoney(stats.paidTotal)],
    ["Reste site", formatMoney(stats.remainingTotal)],
    ["Frais Stripe", formatMoney(stats.stripeFeesTotal)],
    ["Net Stripe", formatMoney(stats.stripeNetTotal)],
    ["Net plateformes importé", formatMoney(stats.platformNetKnown)],
  ];
  return (
    <section style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "7px 0" }} aria-label="Synthèse des paiements">
      {items.map(([label, value]) => (
        <div key={label} style={{ ...styles.infoItem, padding: "6px 10px", minWidth: 125, flex: "1 1 125px", gap: 2 }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
          <strong style={{ fontSize: 14 }}>{value}</strong>
        </div>
      ))}
    </section>
  );
}
