import { styles } from "./adminStyles";
import { StatCard } from "./AdminUi";
import { formatMoney } from "../../utils/adminFormatters";

const TABS = [
  { key: "requests", label: "Demandes" },
  { key: "reservations", label: "Réservations" },
  { key: "calendar", label: "Calendrier" },
  { key: "pricing", label: "Tarifs" },
  { key: "customers", label: "Clients" },
  { key: "crm", label: "CRM" },
  { key: "payments", label: "Paiements" },
  { key: "communication", label: "Communication" },
  { key: "stripe_payouts", label: "Virements Stripe" },
  { key: "reviews", label: "Avis" },
  { key: "visits", label: "Visites" },
  { key: "summary", label: "Synthèse" },
  { key: "users", label: "Utilisateurs" },
];

export default function AdminTopBar({
  stats,
  search,
  statusFilter,
  customerFilter,
  activeTab,
  adminTrackingDisabled,
  onSearchChange,
  onStatusFilterChange,
  onCustomerFilterChange,
  onApplyDashboardFilter,
  onOpenLoyalCustomers,
  onNavigate,
  onRefresh,
  onToggleAdminTracking,
  onPrintWelcomeBooklet,
  onLogout,
  permissions,
}) {
  if (permissions?.isHousekeeping) {
    return (
      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>Planning ménage</p>
          <h1 style={styles.title}>La Maison Verte — Arreau</h1>
          <p style={styles.subtitle}>Calendrier des séjours et informations utiles pour les arrivées, départs et contacts clients.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.refreshButton} onClick={onRefresh}>Actualiser</button>
          <button style={styles.logoutButton} onClick={onLogout}>Déconnexion</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>Administration</p>
          <h1 style={styles.title}>La Maison Verte — Arreau</h1>
          <p style={styles.subtitle}>Demandes en cours, réservations, clients, calendrier, paiements et CRM.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.printButton} onClick={onPrintWelcomeBooklet}>Imprimer le livret</button>
          <button style={styles.refreshButton} onClick={onRefresh}>Actualiser</button>
          <button style={styles.smallButton} onClick={() => onNavigate("users")}>Mon compte</button>
          <button style={adminTrackingDisabled ? styles.smallButton : styles.warningButton} onClick={onToggleAdminTracking}>
            {adminTrackingDisabled ? "Mes visites ignorées" : "Compter mon navigateur"}
          </button>
          <button style={styles.logoutButton} onClick={onLogout}>Déconnexion</button>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Demandes" value={stats.pending} onClick={() => onApplyDashboardFilter("pending")} />
        <StatCard label="Réservations" value={stats.requests} onClick={() => onApplyDashboardFilter("all")} />
        <StatCard label="Acceptées" value={stats.accepted} onClick={() => onApplyDashboardFilter("accepted")} />
        <StatCard label="Payées / confirmées" value={stats.paid} onClick={() => onApplyDashboardFilter("paid_group")} />
        <StatCard label="Confirmées" value={stats.confirmed} onClick={() => onApplyDashboardFilter("confirmed")} />
        <StatCard label="Clients" value={stats.customers} onClick={() => { onCustomerFilterChange("all"); onNavigate("customers"); }} />
        <StatCard label="Clients fidèles" value={stats.loyal} onClick={onOpenLoyalCustomers} />
        <StatCard label="Avis à valider" value={stats.reviewsPending} onClick={() => onNavigate("reviews")} />
        <StatCard label="Total encaissé" value={formatMoney(stats.totalCollected)} onClick={() => onNavigate("payments")} />
        <StatCard label="CA confirmé" value={formatMoney(stats.caConfirmed)} onClick={() => onNavigate("summary")} />
        <StatCard label="Reste à encaisser" value={formatMoney(stats.remainingToCollect)} onClick={() => onNavigate("payments")} />
        <StatCard label="Opt-in marketing" value={stats.marketingConsent} onClick={() => { onCustomerFilterChange("optin_yes"); onNavigate("customers"); }} />
      </section>

      <section style={styles.toolbar}>
        <input
          style={styles.searchInput}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher nom, email, téléphone, dates, notes..."
        />
        <select style={styles.select} value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="pending">À confirmer</option>
          <option value="accepted">Acceptée</option>
          <option value="deposit_paid">Acompte payé</option>
          <option value="paid_group">Payées / confirmées</option>
          <option value="confirmed">Confirmée</option>
          <option value="refused">Refusée</option>
          <option value="expired">Expirée</option>
          <option value="cancelled">Annulée</option>
        </select>
        <select
          style={styles.select}
          value={customerFilter}
          onChange={(event) => {
            onCustomerFilterChange(event.target.value);
            onNavigate("customers");
          }}
        >
          <option value="all">Tous les clients</option>
          <option value="optin_yes">Opt-in oui</option>
          <option value="optin_no">Opt-in non</option>
          <option value="loyal">Clients fidèles</option>
          <option value="multi_stay">Plus de 2 séjours</option>
          <option value="high_value">Plus de 1000 € dépensés</option>
          <option value="recent">Dernier séjour &lt; 2 ans</option>
          <option value="source_site">Source Site</option>
          <option value="source_booking">Source Booking</option>
          <option value="source_airbnb">Source Airbnb</option>
          <option value="source_téléphone">Source Téléphone</option>
        </select>
      </section>

      <nav style={styles.tabs}>
        {TABS.filter((tab) => !permissions || permissions.canViewTab(tab.key)).map((tab) => (
          <button
            key={tab.key}
            style={activeTab === tab.key ? styles.activeTab : styles.tab}
            onClick={() => onNavigate(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}
