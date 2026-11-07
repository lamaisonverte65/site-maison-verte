import { styles } from "../adminStyles";
import ConversationTimeline from "./ConversationTimeline";
import CommunicationFilters from "./CommunicationFilters";
import { getRequestName } from "../../../utils/adminFormatters";
import { useCommunicationFilters } from "../../../hooks/useCommunicationFilters";

export default function CommunicationPanel({ data, onOpenReservation, onOpenCustomer, onOpenPayments, onOpenInvoices }) {
  const activeReservation = data.activeReservation;
  const activeCustomer = data.activeCustomer;
  const contextTitle = activeReservation
    ? `Réservation · ${getRequestName(activeReservation)}`
    : activeCustomer ? `Client · ${data.getCustomerName(activeCustomer)}` : "Tous les clients";
  const { filters, filteredItems, updateFilter, resetFilters } = useCommunicationFilters(data.timeline);

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>Communication <small style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>· {contextTitle}</small></h2>
        {(activeReservation || activeCustomer) && <button style={styles.smallButton} onClick={() => data.setContext({})}>Tous les échanges</button>}
      </div>
      <CommunicationFilters filters={filters} onChange={updateFilter} onReset={resetFilters} />
      <ConversationTimeline items={filteredItems} onOpenReservation={onOpenReservation} onOpenCustomer={onOpenCustomer} onOpenPayments={onOpenPayments} onOpenInvoices={onOpenInvoices} />
    </section>
  );
}
