// Les anomalies d'une source ne doivent pas être présentées comme des données vides.
// Une panne des visites ne doit toutefois pas masquer le tableau financier ou l'accueil.
const TAB_DEPENDENCIES = {
  home: ["payments", "reservations", "guest_reviews", "booking_cleaning_issues", "booking_additional_charges", "stripe_payouts", "stripe_balance_transactions"],
  summary: ["payments", "reservations", "guest_reviews", "booking_cleaning_issues", "booking_additional_charges", "stripe_payouts", "stripe_balance_transactions"],
  payments: ["payments", "stripe_balance_transactions"],
  invoices: ["customer_invoices", "customer_credit_notes"],
  communication: ["booking_events", "email_logs"],
  reviews: ["guest_reviews"],
  visits: ["site_visits_summary"],
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
  site_visits_summary: "Statistiques de visite",
  reservations: "Réservations confirmées",
  stripe_payouts: "Virements Stripe",
  stripe_balance_transactions: "Transactions Stripe",
};

export function getAdminSourceLabel(table) {
  return SOURCE_LABELS[table] || table;
}
