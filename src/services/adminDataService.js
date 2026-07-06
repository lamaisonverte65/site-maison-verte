export async function fetchAdminData(supabase) {
  const { data: requestsData, error: requestsError } = await supabase
    .from("booking_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw requestsError;
  }

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (customersError) {
    throw customersError;
  }

  const { data: paymentsData } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: eventsData } = await supabase
    .from("booking_events")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: emailLogsData } = await supabase
    .from("email_logs")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: guestReviewsData } = await supabase
    .from("guest_reviews")
    .select("*")
    .order("created_at", { ascending: false });

  const sinceVisits = new Date();
  sinceVisits.setDate(sinceVisits.getDate() - 180);

  const { data: siteVisitsData } = await supabase
    .from("site_visits")
    .select("*")
    .gte("created_at", sinceVisits.toISOString())
    .order("created_at", { ascending: false });

  const { count: siteVisitsTotalCount } = await supabase
    .from("site_visits")
    .select("id", { count: "exact", head: true });

  const { data: reservationsData } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: stripePayoutsData } = await supabase
    .from("stripe_payouts")
    .select("*")
    .order("arrival_date", { ascending: false });

  const { data: stripeBalanceTransactionsData } = await supabase
    .from("stripe_balance_transactions")
    .select("*")
    .order("created_at_stripe", { ascending: false });

  return {
    bookingRequests: requestsData || [],
    customers: customersData || [],
    payments: paymentsData || [],
    bookingEvents: eventsData || [],
    emailLogs: emailLogsData || [],
    guestReviews: guestReviewsData || [],
    siteVisits: siteVisitsData || [],
    siteVisitsTotal: siteVisitsTotalCount || (siteVisitsData || []).length,
    confirmedReservations: reservationsData || [],
    stripePayouts: stripePayoutsData || [],
    stripeBalanceTransactions: stripeBalanceTransactionsData || [],
  };
}
