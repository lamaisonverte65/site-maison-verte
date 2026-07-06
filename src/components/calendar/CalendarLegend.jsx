export default function CalendarLegend({ items = [] }) {
  return (
    <div style={styles.legend}>
      {items.map((item) => (
        <div key={item.label} style={styles.legendItem}>
          <div style={{ ...styles.dot, background: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  legend: { display: "flex", gap: "18px", marginBottom: "20px", flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#334155" },
  dot: { width: "14px", height: "14px", borderRadius: "999px" },
};
