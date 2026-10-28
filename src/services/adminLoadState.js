// Dépendances explicites des rubriques de l'admin : une lecture en erreur
// ne doit pas être présentée comme un tableau vide ou un total fiable.
const TAB_DEPENDENCIES = {
  home: ["payments", "reservations", "guest_reviews", "booking_cleaning_issues", "booking_additional_charges", "site_visits", "site_visits_count", "stripe_payouts", "stripe_balance_transactions"],
  summary: ["payments", "reservations", "guest_reviews", "booking_cleaning_issues", "booking_additional_charges", "site_visits", "site_visits_count", "stripe_payouts", "stripe_balance_transactions"],
  payments: ["payments", "stripe_balance_transactions"],
  invoices: ["customer_invoices", "customer_credit_notes"],
  communication: ["booking_events", "email_logs"],
  reviews: ["guest_reviews"],
  visits: ["site_visits", "site_visits_count"],
  stripe_payouts: ["stripe_payouts", "stripe_balance_transactions"],
  reservation_details: [
    "payments", "customer_invoices", "customer_credit_notes",
    "booking_events", "email_logs", "stripe_balance_transactions",
    "booking_cleaning_issues", "booking_additional_charges",
  ],
};

export function getUnavailableAdminSources(tab, loadErrors = {}) {
  return (TAB_DEPENDENCIES[tab] || []).filter((table) => Object.hasOwn(loadErrors, table));
}

const SOURCE_LABELS = {
  payments: "Paiements",
  customer_invoices: "Factures",
  customer_credit_notes: "Avoirs",
  booking_cleaning_issues: "Signalements ménage",
  booking_additional_charges: "Suppléments",
  booking_events: "Événements de réservation",
  email_logs: "Historique des emails",
  guest_reviews: "Avis clients",
  site_visits: "Visites du site",
  site_visits_count: "Total des visites",
  reservations: "Réservations confirmées",
  stripe_payouts: "Virements Stripe",
  stripe_balance_transactions: "Transactions Stripe",
};

export function getAdminSourceLabel(table) {
  return SOURCE_LABELS[table] || table;
}
