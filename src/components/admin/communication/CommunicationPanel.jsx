import { styles } from "../adminStyles";
import ConversationTimeline from "./ConversationTimeline";
import EmailHistoryBlock from "./EmailHistoryBlock";
import MessageTemplatesBlock from "./MessageTemplatesBlock";
import CommunicationFilters from "./CommunicationFilters";
import CommunicationSummary from "./CommunicationSummary";
import CommunicationStatistics from "./CommunicationStatistics";
import ScheduledMessagesPanel from "./ScheduledMessagesPanel";
import { getRequestName } from "../../../utils/adminFormatters";
import { useCommunicationFilters } from "../../../hooks/useCommunicationFilters";
import { useCommunicationTimeline } from "../../../hooks/useCommunicationTimeline";

export default function CommunicationPanel({ data, onOpenReservation, onOpenCustomer }) {
  const activeReservation = data.activeReservation;
  const activeCustomer = data.activeCustomer;
  const contextTitle = activeReservation
    ? `Réservation · ${getRequestName(activeReservation)}`
    : activeCustomer
      ? `Client · ${data.getCustomerName(activeCustomer)}`
      : "Toutes les communications";

  const {
    filters,
    filteredItems,
    updateFilter,
    resetFilters,
  } = useCommunicationFilters(data.timeline);

  const {
    timeline,
    emailItems,
    statistics,
  } = useCommunicationTimeline(filteredItems);

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Communication</h2>
          <p style={styles.muted}>{contextTitle}</p>
        </div>
        {(activeReservation || activeCustomer) && (
          <button style={styles.smallButton} onClick={() => data.setContext(null)}>
            Voir toutes les communications
          </button>
        )}
      </div>

      <CommunicationFilters
        filters={filters}
        onChange={updateFilter}
        onReset={resetFilters}
      />

      <CommunicationSummary
        stats={{
          emails: statistics.emails,
          events: statistics.events,
          messages: statistics.messages,
        }}
        filteredCount={statistics.total}
      />

      <CommunicationStatistics statistics={statistics} />

      <ConversationTimeline
        items={timeline}
        onOpenReservation={onOpenReservation}
        onOpenCustomer={onOpenCustomer}
      />

      <EmailHistoryBlock emails={emailItems} />
      <ScheduledMessagesPanel />
      <MessageTemplatesBlock templates={data.templates} />
    </section>
  );
}
