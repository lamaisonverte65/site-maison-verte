import { readAllAdminRows } from "./adminPaginatedRead.js";

// Une erreur de lecture ne doit jamais devenir silencieusement une liste vide.
// Les erreurs partielles sont retournées à l'administration afin de masquer les vues concernées.
async function readOptionalRows(query, table, loadErrors) {
  try {
    return await query;
  } catch (error) {
    loadErrors[table] = error?.message || "Lecture indisponible";
    return [];
  }
}

async function readVisitSummary(supabase, loadErrors) {
  try {
    const { data, error } = await supabase.rpc("get_admin_visit_summary", { p_days: 30 });
    if (error) throw error;
    if (!data || typeof data !== "object" || !Array.isArray(data.daily) ||
        !Array.isArray(data.sources) || !Array.isArray(data.pages) ||
        !Number.isSafeInteger(data.last30) || data.last30 < 0) {
      throw new Error("Résumé statistique incomplet.");
    }
    return data;
  } catch (error) {
    loadErrors.site_visits_summary = error?.message || "Statistiques indisponibles";
    return null;
  }
}

export async function fetchAdminData(supabase) {
  const loadErrors = {};
  // Toutes les listes doivent etre completes avant de produire des totaux.
  // Ordre secondaire par identifiant pour stabiliser les lignes de meme date.
  const requestsData = await readAllAdminRows(supabase, {
    table: "booking_requests", orderBy: "created_at",
  });
  const customersData = await readAllAdminRows(supabase, {
    table: "customers", orderBy: "created_at",
  });

  const paymentsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "payments", orderBy: "created_at",
  }), "payments", loadErrors);
  const customerInvoicesData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "customer_invoices", orderBy: "created_at",
  }), "customer_invoices", loadErrors);
  const cleaningIssuesData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "booking_cleaning_issues", orderBy: "reported_at",
  }), "booking_cleaning_issues", loadErrors);
  const additionalChargesData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "booking_additional_charges", orderBy: "created_at",
  }), "booking_additional_charges", loadErrors);
  const customerCreditNotesData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "customer_credit_notes", orderBy: "created_at",
  }), "customer_credit_notes", loadErrors);
  const eventsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "booking_events", orderBy: "created_at",
  }), "booking_events", loadErrors);
  const emailLogsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "email_logs", orderBy: "created_at",
  }), "email_logs", loadErrors);
  const guestReviewsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "guest_reviews", orderBy: "created_at",
  }), "guest_reviews", loadErrors);

  // R18 : les événements historiques ne sont plus téléchargés dans le navigateur.
  const siteVisitSummary = await readVisitSummary(supabase, loadErrors);

  const reservationsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "reservations", orderBy: "created_at",
  }), "reservations", loadErrors);
  const stripePayoutsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "stripe_payouts", orderBy: "arrival_date",
  }), "stripe_payouts", loadErrors);
  const stripeBalanceTransactionsData = await readOptionalRows(readAllAdminRows(supabase, {
    table: "stripe_balance_transactions", orderBy: "created_at_stripe",
  }), "stripe_balance_transactions", loadErrors);
  const bookingFinancialAggregatesData = await readAllAdminRows(supabase, {
    table: "booking_financial_ledger_aggregates", orderBy: "booking_request_id", uniqueBy: "booking_request_id",
  });

  return {
    bookingRequests: requestsData || [],
    customers: customersData || [],
    payments: paymentsData || [],
    customerInvoices: customerInvoicesData || [],
    cleaningIssues: cleaningIssuesData || [],
    additionalCharges: additionalChargesData || [],
    customerCreditNotes: customerCreditNotesData || [],
    bookingEvents: eventsData || [],
    emailLogs: emailLogsData || [],
    guestReviews: guestReviewsData || [],
    siteVisitSummary,
    confirmedReservations: reservationsData || [],
    stripePayouts: stripePayoutsData || [],
    stripeBalanceTransactions: stripeBalanceTransactionsData || [],
    bookingFinancialAggregates: bookingFinancialAggregatesData || [],
    loadErrors,
  };
}
