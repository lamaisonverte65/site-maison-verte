import { useEffect, useRef, useState } from "react";
import { styles } from "./adminStyles";

// R29.3 : accès directs, puis rubriques secondaires dans l'ordre demandé.
const HOME_TAB = { key: "home", label: "Accueil" };
const DIRECT_TABS = [
  { key: "requests", label: "Demandes" },
  { key: "calendar", label: "Calendrier" },
  { key: "reservations", label: "Réservations" },
  { key: "customers", label: "Clients" },
  { key: "communication", label: "Communication" },
  { key: "payments", label: "Paiements" },
  { key: "invoices", label: "Factures" },
  { key: "declarations", label: "Déclarations" },
];
const MORE_TABS = [
  { key: "stripe_payouts", label: "Virements Stripe" },
  { key: "summary", label: "Synthèse" },
  { key: "pricing", label: "Tarifs" },
  { key: "users", label: "Utilisateurs" },
  { key: "backups", label: "Sauvegardes" },
  { key: "reviews", label: "Avis" },
  { key: "visits", label: "Visites" },
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  if (permissions?.isHousekeeping) {
    return (
      <div style={styles.stickyAdminNav}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Planning ménage</strong>
          <button type="button" style={styles.navLogoutButton} onClick={onLogout} title="Déconnexion" aria-label="Déconnexion"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 2v10"/><path d="M6.3 5.6a9 9 0 1 0 11.4 0"/></svg></button>
        </div>
      </div>
    );
  }

  const canSeeTab = (key) => {
    if (!permissions) return true;
    if (key === "home") return true;
    if (key === "backups") return permissions.isOwner;
    if (key === "declarations") return permissions.canViewTab("payments") || permissions.canViewTab("summary");
    if (key === "invoices") return permissions.canViewTab("payments");
    return permissions.canViewTab(key);
  };
  const visibleMoreTabs = MORE_TABS.filter((tab) => canSeeTab(tab.key));
  const selectedMoreTab = visibleMoreTabs.some((tab) => tab.key === activeTab);
  const showGlobalFilters = ["requests", "customers"].includes(activeTab);
  const navigate = (key) => {
    setMoreOpen(false);
    onNavigate(key);
  };
  const labelFor = (tab) => {
    const reviewsPending = Number(stats?.reviewsPending || 0);
    return tab.key === "reviews" && reviewsPending > 0 ? `Avis (${reviewsPending})` : tab.label;
  };

  return (
    <>
      <div style={styles.stickyAdminNav}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <nav style={{ ...styles.tabs, flex: "1 1 auto", minWidth: 0 }} aria-label="Rubriques administration">
            <button type="button" aria-label={HOME_TAB.label} title="Accueil" aria-current={activeTab === "home" ? "page" : undefined} style={{ ...(activeTab === "home" ? styles.activeTab : styles.tab), padding: "6px 8px" }} onClick={() => navigate(HOME_TAB.key)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></svg>
            </button>
            {DIRECT_TABS.filter((tab) => canSeeTab(tab.key)).map((tab) => (
              <button key={tab.key} type="button" style={activeTab === tab.key ? styles.activeTab : styles.tab} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => navigate(tab.key)}>
                {labelFor(tab)}
              </button>
            ))}
          </nav>
          {visibleMoreTabs.length > 0 && (
            <div ref={moreRef} style={{ position: "relative", flex: "0 0 auto" }}>
              <button type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} aria-haspopup="true" aria-controls="admin-more-menu" style={selectedMoreTab ? styles.activeTab : styles.tab}>
                Plus <span aria-hidden="true">▾</span>
              </button>
              {moreOpen && (
                <div id="admin-more-menu" role="menu" aria-label="Autres rubriques" style={{ position: "absolute", right: 0, top: "calc(100% + 5px)", zIndex: 50, minWidth: 185, padding: "5px", border: "1px solid #d6d3c8", borderRadius: 11, background: "#fff", boxShadow: "0 10px 25px rgba(0,0,0,0.16)", display: "grid", gap: 2 }}>
                  {visibleMoreTabs.map((tab) => (
                    <button type="button" key={tab.key} role="menuitem" aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => navigate(tab.key)} style={{ border: 0, borderRadius: 7, padding: "8px 10px", cursor: "pointer", textAlign: "left", whiteSpace: "nowrap", background: activeTab === tab.key ? "#2f4f35" : "transparent", color: activeTab === tab.key ? "white" : "#1f2933", fontSize: 12 }}>
                      {labelFor(tab)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" style={styles.navLogoutButton} onClick={onLogout} title="Déconnexion" aria-label="Déconnexion"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 2v10"/><path d="M6.3 5.6a9 9 0 1 0 11.4 0"/></svg></button>
        </div>
      </div>

      {showGlobalFilters && (
        <section style={styles.toolbar}>
          <input style={styles.searchInput} value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher nom, email, téléphone, dates, notes..." />
          <select style={styles.select} value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">Tous les statuts</option><option value="pending">À confirmer</option><option value="accepted">Acceptée</option><option value="deposit_paid">Acompte payé</option><option value="paid_group">Payées / confirmées</option><option value="confirmed">Confirmée</option><option value="refused">Refusée</option><option value="expired">Expirée</option><option value="cancelled">Annulée</option>
          </select>
          <select style={styles.select} value={customerFilter} onChange={(event) => { onCustomerFilterChange(event.target.value); navigate("customers"); }}>
            <option value="all">Tous les clients</option><option value="optin_yes">Opt-in oui</option><option value="optin_no">Opt-in non</option><option value="loyal">Clients fidèles</option><option value="multi_stay">Plus de 2 séjours</option><option value="high_value">Plus de 1000 € dépensés</option><option value="recent">Dernier séjour &lt; 2 ans</option><option value="source_site">Source Site</option><option value="source_booking">Source Booking</option><option value="source_airbnb">Source Airbnb</option><option value="source_téléphone">Source Téléphone</option>
          </select>
        </section>
      )}
    </>
  );
}
