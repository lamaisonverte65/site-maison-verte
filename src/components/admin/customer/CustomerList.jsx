import { styles } from "../adminStyles";
import { SortableTh } from "../AdminUi";
import { formatDate, formatMoney, formatPercent, normalizeSource } from "../../../utils/adminFormatters";

function ReadOnlyTd({ value, onOpenCustomer, customer }) {
  return (
    <td style={styles.td} onClick={() => onOpenCustomer(customer)} title="Ouvrir la fiche client pour modifier">
      {value || "-"}
    </td>
  );
}

export default function CustomerList({
  customers,
  customerSort,
  customerReservations,
  customerActions,
  contactActions,
  onCustomerSort,
  onOpenCustomer,
  selectedCustomerId,
}) {
  if (customers.length === 0) {
    return <p style={styles.empty}>Aucun client trouvé.</p>;
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead style={styles.stickyHead}>
          <tr>
            <th style={styles.th}>Fiche</th>
            <SortableTh label="Nom" sortKey="last_name" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Prénom" sortKey="first_name" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Source" sortKey="source" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Téléphone" sortKey="phone" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Email" sortKey="email" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Séjours" sortKey="booking_count" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="1ère réservation" sortKey="first_stay" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Dernière réservation" sortKey="last_stay" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Total dépensé" sortKey="total_spent" sort={customerSort} onSort={onCustomerSort} />
            <SortableTh label="Net propriétaire" sortKey="owner_net_total" sort={customerSort} onSort={onCustomerSort} />
            <th style={styles.th}>Opt-in</th>
            <SortableTh label="Remise fidélité" sortKey="loyalty_discount_percent" sort={customerSort} onSort={onCustomerSort} />
            <th style={styles.th}>Historique réservations</th>
            <th style={styles.th}>Contact</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const history = customerReservations.get(customer.id) || [];
            const isSelected = selectedCustomerId === customer.id;

            return (
              <tr key={customer.id} style={isSelected ? styles.selectedRow : undefined}>
                <td style={styles.td}>
                  <button
                    style={isSelected ? styles.acceptButton : styles.smallButton}
                    onClick={() => onOpenCustomer(customer)}
                  >
                    {isSelected ? "Ouverte" : "Ouvrir"}
                  </button>
                </td>
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={customer.last_name} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={customer.first_name} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={normalizeSource(customer.source)} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={customer.phone} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={customer.email} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={customer.booking_count ?? history.length ?? 0} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={formatDate(customer.first_stay)} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={formatDate(customer.last_stay)} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={formatMoney(customer.total_spent)} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={formatMoney(customer.owner_net_total)} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={customer.marketing_consent ? "Oui" : "Non"} />
                <ReadOnlyTd customer={customer} onOpenCustomer={onOpenCustomer} value={formatPercent(customer.loyalty_discount_percent || 0)} />
                <td style={styles.td}>
                  <div style={styles.chipList}>
                    {history.length === 0
                      ? "-"
                      : history.map((reservation) => (
                          <button
                            key={reservation.id}
                            style={styles.historyChip}
                            onClick={() => customerActions.selectReservation(reservation)}
                          >
                            {formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}
                          </button>
                        ))}
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={styles.contactButtons}>
                    <button style={styles.smallButton} onClick={() => contactActions.email(customer.email)}>Email</button>
                    <button style={styles.smallButton} onClick={() => contactActions.phone(customer.phone)}>Appel</button>
                    <button style={styles.smallButton} onClick={() => contactActions.sms(customer.phone)}>SMS</button>
                  </div>
                </td>
                <td style={styles.td}>
                  <button style={styles.deleteButton} onClick={() => customerActions.delete(customer)}>Supprimer</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
