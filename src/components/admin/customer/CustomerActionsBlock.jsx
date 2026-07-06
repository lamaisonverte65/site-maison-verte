import { styles } from "../adminStyles";
import PermissionGate from "../common/PermissionGate";
import { ADMIN_PERMISSIONS } from "../../../utils/adminPermissions";

export default function CustomerActionsBlock({
  customer,
  profile,
  contactActions,
  onOpenCommunication,
  permissions,
}) {
  return (
    <section style={{ ...styles.card, marginBottom: "18px" }}>
      <div style={styles.panelHeader}>
        <div>
          <h3 style={styles.subTitle}>Actions client</h3>
          <p style={styles.muted}>Actions rapides liées à la personne, sans modifier les réservations.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.smallButton} onClick={() => contactActions.email(customer.email)} disabled={!customer.email}>Email</button>
          <button style={styles.smallButton} onClick={() => contactActions.phone(customer.phone)} disabled={!customer.phone}>Appel</button>
          <button style={styles.smallButton} onClick={() => contactActions.sms(customer.phone)} disabled={!customer.phone}>SMS</button>
          {onOpenCommunication && (
            <PermissionGate permissions={permissions} permission={ADMIN_PERMISSIONS.viewCommunication}>
              <button style={styles.smallButton} onClick={() => onOpenCommunication({ type: "customer", customer })}>Communication</button>
            </PermissionGate>
          )}
        </div>
      </div>
      {!profile.hasContact && <p style={styles.empty}>Aucun email ou téléphone renseigné : les actions de contact resteront limitées.</p>}
    </section>
  );
}
