import { styles } from "./adminStyles";

const TABS = [
  { key: "home", label: "Accueil" },
  { key: "requests", label: "Demandes" },
  { key: "reservations", label: "Réservations" },
  { key: "calendar", label: "Calendrier" },
  { key: "pricing", label: "Tarifs" },
  { key: "customers", label: "Clients" },
  { key: "crm", label: "CRM" },
  { key: "payments", label: "Paiements" },
  { key: "invoices", label: "Factures" },
  { key: "communication", label: "Communication" },
  { key: "stripe_payouts", label: "Virements Stripe" },
  { key: "reviews", label: "Avis" },
  { key: "visits", label: "Visites" },
  { key: "summary", label: "Synthèse" },
  { key: "users", label: "Utilisateurs" },
  { key: "tourist_tax", label: "Taxe de séjour" },
  { key: "declarations", label: "Déclarations" },
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

  const canSeeTab = (key) => {
    if (!permissions) return true;
    if (key === "home") return true;
    if (key === "tourist_tax") return permissions.canViewTab("pricing");
    if (key === "declarations") return permissions.canViewTab("payments") || permissions.canViewTab("summary");
    if (key === "invoices") return permissions.canViewTab("payments");
    return permissions.canViewTab(key);
  };
  const showGlobalFilters = ["requests", "reservations", "customers"].includes(activeTab);

  return (
    <>
      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>Administration</p>
          <h1 style={styles.title}>La Maison Verte — Arreau</h1>
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

      <div style={styles.stickyAdminNav}>
        <nav style={styles.tabs} aria-label="Rubriques administration">
          {TABS.filter((tab) => canSeeTab(tab.key)).map((tab) => (
            <button key={tab.key} style={activeTab === tab.key ? styles.activeTab : styles.tab} onClick={() => onNavigate(tab.key)}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {showGlobalFilters && (
        <section style={styles.toolbar}>
          <input style={styles.searchInput} value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher nom, email, téléphone, dates, notes..." />
          <select style={styles.select} value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">Tous les statuts</option><option value="pending">À confirmer</option><option value="accepted">Acceptée</option><option value="deposit_paid">Acompte payé</option><option value="paid_group">Payées / confirmées</option><option value="confirmed">Confirmée</option><option value="refused">Refusée</option><option value="expired">Expirée</option><option value="cancelled">Annulée</option>
          </select>
          <select style={styles.select} value={customerFilter} onChange={(event) => { onCustomerFilterChange(event.target.value); onNavigate("customers"); }}>
            <option value="all">Tous les clients</option><option value="optin_yes">Opt-in oui</option><option value="optin_no">Opt-in non</option><option value="loyal">Clients fidèles</option><option value="multi_stay">Plus de 2 séjours</option><option value="high_value">Plus de 1000 € dépensés</option><option value="recent">Dernier séjour &lt; 2 ans</option><option value="source_site">Source Site</option><option value="source_booking">Source Booking</option><option value="source_airbnb">Source Airbnb</option><option value="source_téléphone">Source Téléphone</option>
          </select>
        </section>
      )}
    </>
  );
}
