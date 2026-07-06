import { useMemo, useState } from "react";
import { styles } from "../adminStyles";
import CrmStatsBlock from "./CrmStatsBlock";
import LoyalCustomersBlock from "./LoyalCustomersBlock";
import FollowUpBlock from "./FollowUpBlock";
import MarketingConsentBlock from "./MarketingConsentBlock";
import CustomerSegmentsBlock from "./CustomerSegmentsBlock";
import CustomerTagsBlock from "./CustomerTagsBlock";
import CrmActionsBlock from "./CrmActionsBlock";
import CrmOpportunitiesBlock from "./CrmOpportunitiesBlock";
import { useCrmSegments } from "../../../hooks/useCrmSegments";

export default function CrmPanel({
  data,
  contactActions,
  onOpenCustomer,
  onOpenReservation,
  onOpenCommunication,
  onShowAllCustomers,
  onShowLoyalCustomers,
}) {
  const [activeSegment, setActiveSegment] = useState("");
  const upcoming = data.customersWithUpcomingStay || [];
  const { segments } = useCrmSegments(data);
  const selectedSegment = segments.find((segment) => segment.key === activeSegment);
  const selectedCustomers = useMemo(() => selectedSegment?.customers || data.customers || [], [selectedSegment, data.customers]);

  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>CRM & suivi clients</h2>
          <p style={styles.muted}>Suivi relation client : fidélité, relances, opt-in et prochains séjours.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.smallButton} onClick={onShowAllCustomers}>Voir clients</button>
          <button style={styles.smallButton} onClick={onShowLoyalCustomers}>Clients fidèles</button>
        </div>
      </div>

      <CrmStatsBlock
        stats={data.stats}
        onShowAllCustomers={onShowAllCustomers}
        onShowLoyalCustomers={onShowLoyalCustomers}
      />

      <div style={styles.summaryGrid}>
        <MarketingConsentBlock
          optInCustomers={data.marketingOptIn}
          noConsentCustomers={data.marketingNoConsent}
          onShowAllCustomers={onShowAllCustomers}
        />

        <section style={styles.card}>
          <h3 style={styles.subTitle}>Prochains séjours clients</h3>
          {upcoming.length === 0 ? (
            <p style={styles.empty}>Aucun séjour futur relié à une fiche client.</p>
          ) : (
            <div style={styles.chipList}>
              {upcoming.slice(0, 12).map((customer) => (
                <button
                  key={customer.id}
                  style={styles.historyChip}
                  onClick={() => onOpenReservation(customer.nextStay)}
                >
                  {customer.displayName} · {customer.nextStay?.start_date}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>


      <div style={styles.summaryGrid}>
        <CustomerSegmentsBlock
          segments={segments}
          activeSegment={activeSegment}
          onSelectSegment={setActiveSegment}
          onClearSegment={() => setActiveSegment("")}
        />

        <CrmActionsBlock
          selectedCustomers={selectedCustomers}
          contactActions={contactActions}
          onOpenCustomer={onOpenCustomer}
          onOpenCommunication={onOpenCommunication}
        />
      </div>

      <CrmOpportunitiesBlock
        customers={selectedCustomers}
        onOpenCustomer={onOpenCustomer}
        onOpenCommunication={onOpenCommunication}
      />

      <CustomerTagsBlock
        customers={selectedCustomers}
        onOpenCustomer={onOpenCustomer}
      />

      <FollowUpBlock
        customers={activeSegment ? selectedCustomers.filter((customer) => data.followUpCustomers.some((item) => item.id === customer.id)) : data.followUpCustomers}
        contactActions={contactActions}
        onOpenCustomer={onOpenCustomer}
        onOpenCommunication={onOpenCommunication}
      />

      <LoyalCustomersBlock
        customers={(activeSegment ? selectedCustomers : [...data.loyalCustomers, ...data.highValueCustomers]).filter((customer, index, list) => list.findIndex((item) => item.id === customer.id) === index)}
        contactActions={contactActions}
        onOpenCustomer={onOpenCustomer}
        onOpenCommunication={onOpenCommunication}
      />
    </section>
  );
}
