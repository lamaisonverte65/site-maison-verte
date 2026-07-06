import { styles } from "../adminStyles";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "../../../utils/adminPermissions";

export default function UserAccessMatrix({ value = [], onChange, disabled = false }) {
  const selected = new Set(value || []);

  function toggle(permission) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    onChange?.([...next]);
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      {PERMISSION_GROUPS.map((group) => (
        <section key={group.label} style={styles.card}>
          <h4 style={{ marginTop: 0 }}>{group.label}</h4>
          <div style={styles.summaryGrid}>
            {group.permissions.map((permission) => (
              <label key={permission} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.92rem" }}>
                <input
                  type="checkbox"
                  checked={selected.has(permission)}
                  disabled={disabled}
                  onChange={() => toggle(permission)}
                />
                {PERMISSION_LABELS[permission] || permission}
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
