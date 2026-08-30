import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchAdminData } from "../services/adminDataService";
import {
  fetchAdminDataForRole,
  fetchHousekeepingData,
  createHousekeepingNote,
  fetchHousekeepingNotes,
} from "../services/housekeepingService";
import {
  createCheckoutSession,
  createManualPayment,
  refundBookingPayment,
  sendDecisionEmail,
  logBookingEvent,
} from "../services/bookingActionsService";
import CalendarAdmin from "../components/CalendarAdmin";
import PricingAdmin from "../components/PricingAdmin";
import AdminLogin from "./AdminLogin";
import { styles } from "../components/admin/adminStyles";
import RequestsPanel from "../components/admin/RequestsPanel";
import ReservationsPanel from "../components/admin/ReservationsPanel";
import ReservationPanel from "../components/admin/ReservationPanel";
import CustomersPanel from "../components/admin/CustomersPanel";
import PaymentsPanel from "../components/admin/PaymentsPanel";
import AdminTopBar from "../components/admin/AdminTopBar";
import VisitsPanel from "../components/admin/VisitsPanel";
import SummaryPanel from "../components/admin/SummaryPanel";
import ReviewsPanel from "../components/admin/ReviewsPanel";
import StripePayoutsPanel from "../components/admin/StripePayoutsPanel";
import CommunicationPanel from "../components/admin/communication/CommunicationPanel";
import CrmPanel from "../components/admin/crm/CrmPanel";
import UsersPanel from "../components/admin/users/UsersPanel";
import { ActionModal } from "../components/admin/AdminUi";
import {
  formatMoney,
  addHours,
  daysUntil,
  getAmounts,
} from "../utils/adminFormatters";
import { useReservationData } from "../hooks/useReservationData";
import { useCustomerData } from "../hooks/useCustomerData";
import { useVisitsData } from "../hooks/useVisitsData";
import { usePaymentData } from "../hooks/usePaymentData";
import { useAdminStats } from "../hooks/useAdminStats";
import { useNavigationContext } from "../hooks/useNavigationContext";
import { useCommunicationData } from "../hooks/useCommunicationData";
import { useCrmData } from "../hooks/useCrmData";
import { useAdminPermissions } from "../hooks/useAdminPermissions";
import { useAdminUsers } from "../hooks/useAdminUsers";

const ACTIVE_BLOCKING_STATUSES = ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed"];

export default function Admin() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [bookingEvents, setBookingEvents] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [guestReviews, setGuestReviews] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [ownVisitorId, setOwnVisitorId] = useState("");
  const [adminTrackingDisabled, setAdminTrackingDisabled] = useState(true);
  const [confirmedReservations, setConfirmedReservations] = useState([]);
  const [stripePayouts, setStripePayouts] = useState([]);
  const [stripeBalanceTransactions, setStripeBalanceTransactions] = useState([]);
  const [housekeepingReservations, setHousekeepingReservations] = useState([]);
  const [ownerHousekeepingNotes, setOwnerHousekeepingNotes] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [calendarEditRequest, setCalendarEditRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [customerSort, setCustomerSort] = useState({ key: "last_name", direction: "asc" });
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const adminUsersData = useAdminUsers({ session });
  const permissions = useAdminPermissions(session, adminUsersData.currentAdminUser);
  const isHousekeepingUser = adminUsersData.currentAdminUser?.role === "housekeeping";

  const navigation = useNavigationContext({
    customers,
    setActiveTab,
    setSelectedRequest,
  });

  useEffect(() => {
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("lmv_admin_browser", "1");
      setOwnVisitorId(window.localStorage.getItem("lmv_visitor_id") || "");
      setAdminTrackingDisabled(window.localStorage.getItem("lmv_admin_browser") === "1");
    } catch {
      // localStorage peut être bloqué en navigation privée : ce n'est pas bloquant.
    }
  }, []);

  useEffect(() => {
    if (session && adminUsersData.currentAdminUser) loadAdminData();
  }, [session, adminUsersData.currentAdminUser]);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function loadAdminData() {
    setLoading(true);
    setError("");

    try {
      const adminData = await fetchAdminDataForRole(adminUsersData.currentAdminUser?.role, {
        loadHousekeeping: () => fetchHousekeepingData({ accessToken: session?.access_token }),
        loadOwner: () => fetchAdminData(supabase),
      });
      if (isHousekeepingUser) {
        setHousekeepingReservations(adminData.reservations || []);
        return;
      }
      const nextRequests = adminData.bookingRequests;

      setBookingRequests(nextRequests);
      setCustomers(adminData.customers);
      setPayments(adminData.payments);
      setBookingEvents(adminData.bookingEvents);
      setEmailLogs(adminData.emailLogs);
      setGuestReviews(adminData.guestReviews);
      setSiteVisits(adminData.siteVisits);
      setConfirmedReservations(adminData.confirmedReservations);
      setStripePayouts(adminData.stripePayouts);
      setStripeBalanceTransactions(adminData.stripeBalanceTransactions);
      setSelectedRequest((current) => current ? nextRequests.find((request) => request.id === current.id) || current : current);
    } catch (error) {
      setError(error.message || "Erreur lors du chargement des données admin.");
    } finally {
      setLoading(false);
    }
  }

  async function saveHousekeepingNote(reservationId, note) {
    await createHousekeepingNote({ accessToken: session?.access_token, reservationId, note });
    await loadAdminData();
  }

  function selectReservation(request) {
    if (!request) return;
    setSelectedRequest(request);
  }

  function openCalendarReservation(request) {
    selectReservation(request);
  }

  function editReservation(request) {
    if (!request) return;
    // L’édition se fait désormais directement dans la fiche réservation complète.
    // On conserve cette fonction pour compatibilité avec les anciens appels éventuels.
    setSelectedRequest(request);
  }

  async function deleteReservation(request) {
    if (!request?.id) return;
    const label = [request.guest_first_name, request.guest_last_name].filter(Boolean).join(" ") || "cette réservation";
    if (!window.confirm(`Supprimer ${label} ?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/.netlify/functions/delete-booking-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ bookingId: request.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Erreur suppression réservation.");
      alert("Réservation supprimée.");
      setSelectedRequest(null);
      setCalendarEditRequest(null);
      await loadAdminData();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  function closeReservation() {
    setSelectedRequest(null);
    setCalendarEditRequest(null);
  }

  function hasDateConflict(currentRequest) {
    return bookingRequests.some((request) => {
      if (request.id === currentRequest.id) return false;
      if (!ACTIVE_BLOCKING_STATUSES.includes(request.status)) return false;
      return currentRequest.start_date < request.end_date && currentRequest.end_date > request.start_date;
    });
  }


  function openAcceptModal(request) {
    if (hasDateConflict(request)) {
      alert("Impossible d’accepter : une autre demande est déjà acceptée/payée/confirmée sur ces dates.");
      return;
    }

    const untilArrival = daysUntil(request.start_date);
    const paymentMode = untilArrival !== null && untilArrival <= 30 ? "total" : "deposit";
    const helper = paymentMode === "total"
      ? "La réservation est à moins de 30 jours : le lien Stripe demandera le paiement total."
      : "Un lien Stripe d’acompte de 30% sera créé et ajouté à l’email.";

    setModal({
      type: "accept",
      request,
      title: "Accepter la demande",
      price: request.owner_price || request.estimated_total || "",
      message: paymentMode === "total"
        ? "Votre demande est acceptée. La réservation sera confirmée après paiement du montant total du séjour."
        : "Votre demande est acceptée. La réservation sera confirmée après paiement de l’acompte.",
      helper,
      confirmText: "Je confirme l’acceptation et l’envoi du lien de paiement.",
    });
  }

  function openRefuseModal(request) {
    setModal({
      type: "refuse",
      request,
      title: "Refuser la demande",
      message: "Nous sommes désolés, mais les dates demandées ne sont malheureusement pas disponibles.",
      helper: "Le client recevra ce message par email.",
      confirmText: "Je confirme le refus de cette demande.",
    });
  }

  function openConfirmModal(request) {
    setModal({
      type: "confirm",
      request,
      title: "Confirmer la réservation manuellement",
      message: "Votre réservation est confirmée. Merci pour votre confiance.",
      helper: "À utiliser uniquement en secours manuel. Stripe confirme automatiquement après paiement.",
      confirmText: "Je confirme manuellement cette réservation.",
    });
  }

  function openCancelModal(request) {
    const paid = getAmounts(request).paid;
    setModal({
      type: "cancel",
      request,
      title: "Annuler / rembourser la réservation",
      message: "La réservation est annulée. Le remboursement sera traité selon les conditions applicables.",
      helper: `Montant déjà payé : ${formatMoney(paid)}. Choisis qui annule et le remboursement à effectuer. L'action Stripe sera déclenchée après confirmation.`,
      confirmText: "Je confirme l’annulation et l’éventuel remboursement Stripe.",
      cancellationType: "client",
      refundMode: "policy",
      refundAmount: "",
    });
  }

  function openManualPaymentModal(request, reason = "solde") {
    const amounts = getAmounts(request);
    const amountPaid = Number(amounts.paid || 0);
    const suggestedAmounts = {
      acompte: Math.max(Number(amounts.deposit || 0) - amountPaid, 0),
      solde: Math.max(Number(amounts.total || 0) - amountPaid, 0),
      total: Number(amounts.total || 0),
      complement: "",
    };

    const titles = {
      acompte: "Demander un acompte",
      solde: "Demander le solde",
      total: "Demander un paiement total",
      complement: "Demander un complément",
    };

    const messages = {
      acompte: "Merci de régler l’acompte via le lien sécurisé ci-dessous afin de confirmer votre réservation.",
      solde: "Merci de régler le solde de votre séjour via le lien sécurisé ci-dessous.",
      total: "Merci de régler le montant total convenu pour votre séjour via le lien sécurisé ci-dessous.",
      complement: "Merci de régler le complément demandé via le lien sécurisé ci-dessous.",
    };

    setModal({
      type: "manual_payment",
      request,
      title: titles[reason] || "Envoyer un lien de paiement",
      price: suggestedAmounts[reason] === 0 ? "" : String(suggestedAmounts[reason] ?? ""),
      reason,
      message: messages[reason] || "Merci de procéder au paiement via le lien sécurisé ci-dessous.",
      helper: "Le lien Stripe sera créé depuis l’admin et envoyé au client. Le motif choisi pilotera les statuts après paiement.",
      confirmText: "Je confirme la création du lien Stripe et l’envoi de l’email au client.",
    });
  }

  function openRefundOnlyModal(request) {
    const paid = getAmounts(request).paid;
    setModal({
      type: "refund_only",
      request,
      title: "Remboursement simple sans annulation",
      message: "Un remboursement va être effectué sans annuler votre réservation.",
      helper: `Montant déjà payé : ${formatMoney(paid)}. Cette action déclenche un remboursement Stripe mais ne change pas le statut de la réservation et ne libère pas les dates.`,
      confirmText: "Je confirme ce remboursement Stripe sans annulation de la réservation.",
      refundMode: "custom",
      refundAmount: "",
    });
  }

  async function submitModal(values) {
    if (!modal) return;
    const request = modal.request;

    if (!values.confirmed) return alert("Coche la case de confirmation avant de valider.");
    if (!values.message?.trim()) return alert("Le message est obligatoire.");

    try {
      if (modal.type === "accept") {
        const proposedPrice = Number(values.price || 0);
        if (!proposedPrice || proposedPrice <= 0) return alert("Tarif invalide.");

        const acceptanceExpiresAt = addHours(24);
        const checkoutSession = await createCheckoutSession(supabase, request, proposedPrice);
        const paymentLink = checkoutSession.url;
        const paymentType = checkoutSession.paymentType || (daysUntil(request.start_date) !== null && daysUntil(request.start_date) <= 30 ? "full" : "deposit");
        const paymentAmount = checkoutSession.amount;
        const daysBeforeArrival = daysUntil(request.start_date);

        await sendDecisionEmail(supabase, request, "accepted", proposedPrice, values.message, {
          paymentLink,
          acceptanceExpiresAt,
          paymentType,
          paymentAmount,
          daysBeforeArrival,
        });

        const discountAmount = Number(request.estimated_total || 0) - proposedPrice;
        const total = Number(proposedPrice);
        const deposit = Math.round(total * 0.3);
        const balance = Math.max(total - deposit, 0);
        const isLateBooking = paymentType === "full";

        const { error } = await supabase.from("booking_requests").update({
          status: "accepted",
          owner_price: proposedPrice,
          payment_link: paymentLink,
          acceptance_expires_at: acceptanceExpiresAt,
          discount_amount: discountAmount > 0 ? discountAmount : 0,
          discount_reason: discountAmount > 0 ? "Tarif spécial propriétaire" : null,
          owner_message: values.message,
          accepted_at: new Date().toISOString(),
          deposit_amount: isLateBooking ? 0 : deposit,
          balance_amount: isLateBooking ? total : balance,
          deposit_status: isLateBooking ? "non applicable" : "à payer",
          balance_status: isLateBooking ? "à payer" : "en attente",
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);

        if (error) throw error;
        await logBookingEvent(supabase, request.id, "booking_accepted", "Demande acceptée", `Lien de paiement envoyé. Tarif proposé : ${proposedPrice} €`, { price: proposedPrice, paymentLink, paymentType });
        alert("Demande acceptée, lien Stripe créé et email envoyé.");
      }

      if (modal.type === "refuse") {
        await sendDecisionEmail(supabase, request, "refused", null, values.message);
        const { error } = await supabase.from("booking_requests").update({
          status: "refused",
          owner_message: values.message,
          refused_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);
        if (error) throw error;
        await logBookingEvent(supabase, request.id, "booking_refused", "Demande refusée", values.message, {});
        alert("Demande refusée et email envoyé.");
      }

      if (modal.type === "confirm") {
        await sendDecisionEmail(supabase, request, "confirmed", request.owner_price || request.estimated_total, values.message);
        const { error } = await supabase.from("booking_requests").update({
          status: "confirmed",
          payment_status: request.payment_status || "manual_confirmed",
          owner_message: values.message,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);
        if (error) throw error;
        await supabase.from("booking_requests").update({ status: "expired", updated_at: new Date().toISOString() })
          .neq("id", request.id)
          .in("status", ["pending", "accepted"])
          .lt("start_date", request.end_date)
          .gt("end_date", request.start_date);
        await logBookingEvent(supabase, request.id, "booking_confirmed_manual", "Réservation confirmée manuellement", values.message, {});
        alert("Réservation confirmée.");
      }

      if (modal.type === "cancel") {
        const result = await refundBookingPayment(supabase, request, values);
        const refunded = Number(result.refundedAmount || 0);
        alert(refunded > 0
          ? `Réservation annulée et remboursement Stripe effectué : ${formatMoney(refunded)}.`
          : "Réservation annulée sans remboursement Stripe.");
      }

      if (modal.type === "refund_only") {
        const result = await refundBookingPayment(supabase, request, { ...values, action: "refund_only", refundOnly: true });
        const refunded = Number(result.refundedAmount || 0);
        alert(refunded > 0
          ? `Remboursement Stripe effectué sans annulation : ${formatMoney(refunded)}.`
          : "Aucun remboursement Stripe n’a été effectué.");
      }

      if (modal.type === "manual_payment") {
        const amount = Number(values.price || 0);
        if (!amount || amount <= 0) return alert("Montant invalide.");

        const payment = await createManualPayment(supabase, request, amount, values.reason || "solde", values.message);

        const { error } = await supabase.from("booking_requests").update({
          manual_payment_amount: amount,
          manual_payment_link: payment.url,
          manual_payment_reason: values.reason || "solde",
          manual_payment_message: values.message,
          manual_payment_status: "à payer",
          manual_payment_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);

        if (error) throw error;
        await logBookingEvent(supabase, request.id, "manual_payment_requested", "Lien de paiement manuel envoyé", `${values.reason || "autre"} · ${amount} €`, { amount, reason: values.reason || "autre", url: payment.url });
        alert("Lien de paiement créé et email envoyé au client.");
      }

      setModal(null);
      await loadAdminData();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }


  async function updateCustomer(customerId, updates) {
    if (!customerId || !updates || Object.keys(updates).length === 0) return;

    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("customers").update(payload).eq("id", customerId);
    if (error) throw error;

    setCustomers((currentCustomers) => currentCustomers.map((customer) => (
      customer.id === customerId ? { ...customer, ...payload } : customer
    )));
    await loadAdminData();
  }

  async function addCustomer() {
    const { data, error } = await supabase.from("customers").insert([{
      first_name: "",
      last_name: "Nouveau client",
      source: "admin",
      booking_count: 0,
    }]).select().single();

    if (error) return alert("Erreur : " + error.message);
    await loadAdminData();
    alert("Client créé. Ouvre sa fiche pour compléter les champs, puis clique sur Enregistrer.");
    return data;
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(`Supprimer le client ${customer.first_name || ""} ${customer.last_name || ""} ?`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) return alert("Erreur suppression : " + error.message);
    await loadAdminData();
  }

  async function updateReviewStatus(review, status) {
    const updates = {
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("guest_reviews").update(updates).eq("id", review.id);
    if (error) return alert("Erreur avis : " + error.message);
    await loadAdminData();
  }

  async function deleteGuestReview(review) {
    if (!window.confirm("Supprimer définitivement cet avis ?")) return;
    const { error } = await supabase.from("guest_reviews").delete().eq("id", review.id);
    if (error) return alert("Erreur suppression avis : " + error.message);
    await loadAdminData();
  }

  function handleCustomerSort(key) {
    setCustomerSort((previous) => previous.key === key ? { key, direction: previous.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  }

  function contactEmail(email) { if (email) window.location.href = `mailto:${email}`; }
  function contactPhone(phone) { if (phone) window.location.href = `tel:${phone}`; }
  function contactSms(phone) { if (phone) window.location.href = `sms:${phone}`; }

  function bulkEmail(target) {
    const list = target === "loyal" ? customers.filter((customer) => Number(customer.booking_count || 0) > 1) : customers;
    const emails = [...new Set(list.map((customer) => customer.email).filter(Boolean))];
    if (emails.length === 0) return alert("Aucun email disponible.");
    const first = emails[0];
    const rest = emails.slice(1).join(",");
    const subject = target === "loyal" ? "La Maison Verte - message clients fidèles" : "La Maison Verte - message clients";
    window.location.href = `mailto:${encodeURIComponent(first)}?bcc=${encodeURIComponent(rest)}&subject=${encodeURIComponent(subject)}`;
  }

  function applyDashboardFilter(filter) {
    setStatusFilter(filter);
    setActiveTab(filter === "pending" ? "requests" : "reservations");
  }

  function openLoyalCustomers() {
    setCustomerFilter("loyal");
    setActiveTab("customers");
  }

  function printWelcomeBooklet() {
    window.open("/livret?print=1", "_blank", "noopener,noreferrer");
  }

  function toggleAdminTracking() {
    try {
      if (adminTrackingDisabled) {
        window.localStorage.removeItem("lmv_admin_browser");
        setAdminTrackingDisabled(false);
        alert("Ce navigateur sera à nouveau compté dans les visites publiques.");
      } else {
        window.localStorage.setItem("lmv_admin_browser", "1");
        setAdminTrackingDisabled(true);
        setOwnVisitorId(window.localStorage.getItem("lmv_visitor_id") || "");
        alert("Ce navigateur ne sera plus compté dans les statistiques publiques.");
      }
    } catch {
      alert("Impossible de modifier le réglage local du navigateur.");
    }
  }

  const {
    sortedReservations,
    pendingRequests,
    selectedReservation,
    selectedReservationData,
  } = useReservationData({
    bookingRequests,
    search,
    statusFilter,
    selectedRequest,
    payments,
    bookingEvents,
    emailLogs,
  });

  const { customerReservations, filteredCustomers } = useCustomerData({
    customers,
    bookingRequests,
    search,
    customerSort,
    customerFilter,
  });

  const {
    visibleSiteVisits,
    pageViewVisits,
    clickEvents,
    analyticsStats,
    pageStats,
    deviceStats,
    browserStats,
    screenStats,
    clickedLinkStats,
    sectionStats,
    languageStats,
    dailyVisitStats,
    visitSessions,
    visitsSince,
  } = useVisitsData({
    siteVisits,
    ownVisitorId,
  });

  const {
    stats,
    sourceStats,
    visitSourceStats,
    visitCountryStats,
  } = useAdminStats({
    bookingRequests,
    confirmedReservations,
    customers,
    guestReviews,
    pageViewVisits,
    stripePayouts,
    stripeBalanceTransactions,
    visitsSince,
  });

  const { paymentRows } = usePaymentData({
    bookingRequests,
    stripeBalanceTransactions,
  });

  const communicationData = useCommunicationData({
    bookingRequests,
    customers,
    emailLogs,
    bookingEvents,
    selectedReservation: selectedReservation || selectedRequest,
    selectedCustomer: navigation.selectedCustomer,
  });

  const crmData = useCrmData({
    customers,
    bookingRequests,
    customerReservations,
  });

  function openCommunicationContext(context = {}) {
    communicationData.setContext(context);
    setActiveTab("communication");
  }

  const reservationActions = {
    accept: openAcceptModal,
    refuse: openRefuseModal,
    confirm: openConfirmModal,
    cancel: openCancelModal,
    manualPayment: openManualPaymentModal,
    refundOnly: openRefundOnlyModal,
  };

  const contactActions = {
    email: contactEmail,
    phone: contactPhone,
    sms: contactSms,
  };

  const customerActions = {
    update: updateCustomer,
    bulkEmail,
    add: addCustomer,
    delete: deleteCustomer,
    selectReservation,
  };

  const visitsData = {
    stats,
    analyticsStats,
    clickEvents,
    dailyVisitStats,
    visitSourceStats,
    pageStats,
    clickedLinkStats,
    visitCountryStats,
    deviceStats,
    browserStats,
    screenStats,
    languageStats,
    sectionStats,
    visitSessions,
    visibleSiteVisits,
  };

  const openedReservation = selectedReservation || selectedRequest;
  const openedReservationId = openedReservation?.id;
  const openedReservationPayments = selectedReservationData?.payments || payments.filter((payment) => payment.booking_request_id === openedReservationId || payment.booking_id === openedReservationId);
  const openedReservationEvents = selectedReservationData?.events || bookingEvents.filter((event) => event.booking_request_id === openedReservationId || event.booking_id === openedReservationId);
  const openedReservationEmailLogs = selectedReservationData?.emailLogs || emailLogs.filter((log) => log.booking_request_id === openedReservationId || log.booking_id === openedReservationId);
  const canManageOpenedReservation = Boolean(openedReservationId) && !openedReservation?.uid;

  useEffect(() => {
    let active = true;
    if (!session?.access_token || !openedReservation) {
      setOwnerHousekeepingNotes([]);
      return () => { active = false; };
    }
    const reservationId = openedReservation.uid
      ? `external:${openedReservation.source}:${openedReservation.uid}`
      : openedReservation.id;
    fetchHousekeepingNotes({ accessToken: session.access_token, reservationId })
      .then((notes) => { if (active) setOwnerHousekeepingNotes(notes); })
      .catch(() => { if (active) setOwnerHousekeepingNotes([]); });
    return () => { active = false; };
  }, [session?.access_token, openedReservation?.id, openedReservation?.uid, openedReservation?.source]);

  if (authLoading) return <p style={{ padding: 30 }}>Chargement...</p>;
  if (!session) return <AdminLogin onLogin={checkSession} />;

  if (isHousekeepingUser) {
    return (
      <main style={styles.page}>
        <section style={styles.header}>
          <div>
            <p style={styles.kicker}>Planning ménage</p>
            <h1 style={styles.title}>La Maison Verte — Arreau</h1>
            <p style={styles.subtitle}>Calendrier des séjours et informations utiles pour les arrivées, départs et contacts clients.</p>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.refreshButton} onClick={loadAdminData}>Actualiser</button>
            <button style={styles.logoutButton} onClick={handleLogout}>Déconnexion</button>
          </div>
        </section>

        {loading && <p style={styles.info}>Chargement des données...</p>}
        {error && <p style={styles.error}>Erreur Supabase : {error}</p>}

        {!loading && !error && (
          <CalendarAdmin
            mode="housekeeping"
            housekeepingReservations={housekeepingReservations}
            onHousekeepingNoteCreate={saveHousekeepingNote}
            onCalendarUpdated={loadAdminData}
          />
        )}
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <AdminTopBar
        stats={stats}
        search={search}
        statusFilter={statusFilter}
        customerFilter={customerFilter}
        activeTab={activeTab}
        adminTrackingDisabled={adminTrackingDisabled}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onCustomerFilterChange={setCustomerFilter}
        onApplyDashboardFilter={applyDashboardFilter}
        onOpenLoyalCustomers={openLoyalCustomers}
        onNavigate={setActiveTab}
        onRefresh={loadAdminData}
        onToggleAdminTracking={toggleAdminTracking}
        onPrintWelcomeBooklet={printWelcomeBooklet}
        onLogout={handleLogout}
        permissions={permissions}
      />

      {!loading && !error && activeTab === "summary" && (
        <SummaryPanel
          stats={stats}
          sourceStats={sourceStats}
          visitSourceStats={visitSourceStats}
          visitCountryStats={visitCountryStats}
          onNavigate={setActiveTab}
        />
      )}

      {loading && <p style={styles.info}>Chargement des données...</p>}
      {error && <p style={styles.error}>Erreur Supabase : {error}</p>}

      {!loading && !error && activeTab === "requests" && (
        <RequestsPanel
          pendingRequests={pendingRequests}
          selectedRequest={selectedRequest}
          onSelectReservation={selectReservation}
          onShowReservations={() => setActiveTab("reservations")}
        />
      )}

      {!loading && !error && activeTab === "reservations" && (
        <ReservationsPanel
          sortedReservations={sortedReservations}
          selectedRequest={selectedReservation || selectedRequest}
          onSelectReservation={selectReservation}
        />
      )}

      {!loading && !error && activeTab === "calendar" && (
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Calendrier central</h2>
          <CalendarAdmin
            mode="admin"
            onSelectReservation={openCalendarReservation}
            onCalendarUpdated={loadAdminData}
            reservationToEdit={calendarEditRequest}
            onReservationEditHandled={() => setCalendarEditRequest(null)}
          />
        </section>
      )}

      {!loading && !error && activeTab === "pricing" && <section style={styles.panel}><h2 style={styles.panelTitle}>Gestion des tarifs</h2><PricingAdmin /></section>}

      {!loading && !error && activeTab === "customers" && (
        <CustomersPanel
          customerFilter={customerFilter}
          onCustomerFilterChange={setCustomerFilter}
          customers={customers}
          filteredCustomers={filteredCustomers}
          customerSort={customerSort}
          customerReservations={customerReservations}
          customerActions={customerActions}
          contactActions={contactActions}
          onCustomerSort={handleCustomerSort}
          selectedCustomer={navigation.selectedCustomer}
          onSelectCustomer={(customer) => navigation.openCustomer(customer, activeTab)}
          onCloseCustomer={navigation.closeCustomer}
          onOpenCommunication={openCommunicationContext}
          permissions={permissions}
        />
      )}


      {!loading && !error && activeTab === "communication" && (
        <CommunicationPanel
          data={communicationData}
          onOpenReservation={selectReservation}
          onOpenCustomer={navigation.openCustomer}
        />
      )}

      {!loading && !error && activeTab === "crm" && (
        <CrmPanel
          data={crmData}
          contactActions={contactActions}
          onOpenCustomer={(customer) => navigation.openCustomer(customer, activeTab)}
          onOpenReservation={selectReservation}
          onOpenCommunication={openCommunicationContext}
          onShowAllCustomers={() => {
            setCustomerFilter("all");
            setActiveTab("customers");
          }}
          onShowLoyalCustomers={openLoyalCustomers}
        />
      )}


      {!loading && !error && activeTab === "users" && (
        <UsersPanel
          data={adminUsersData}
          permissions={permissions}
        />
      )}

      {!loading && !error && activeTab === "reviews" && (
        <ReviewsPanel
          guestReviews={guestReviews}
          onUpdateReviewStatus={updateReviewStatus}
          onDeleteGuestReview={deleteGuestReview}
        />
      )}

      {!loading && !error && activeTab === "visits" && (
        <VisitsPanel
          data={visitsData}
          adminTrackingDisabled={adminTrackingDisabled}
          onRefresh={loadAdminData}
          onToggleAdminTracking={toggleAdminTracking}
        />
      )}

      {!loading && !error && activeTab === "payments" && (
        <PaymentsPanel paymentRows={paymentRows} />
      )}

      {!loading && !error && activeTab === "stripe_payouts" && (
        <StripePayoutsPanel
          stripePayouts={stripePayouts}
          stripeBalanceTransactions={stripeBalanceTransactions}
          onRefresh={loadAdminData}
        />
      )}

      {!loading && !error && openedReservation && (
        <section style={{ ...styles.panel, marginTop: "28px" }}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Fiche réservation</h2>
              <p style={styles.muted}>Fiche unique ouverte depuis le calendrier, la page réservations, une fiche client, le CRM ou la communication.</p>
            </div>
            <button style={styles.smallButton} onClick={closeReservation}>Fermer la fiche</button>
          </div>

          <ReservationPanel
            request={openedReservation}
            payments={openedReservationPayments}
            events={openedReservationEvents}
            emailLogs={openedReservationEmailLogs}
            housekeepingNotes={ownerHousekeepingNotes}
            onAccept={openAcceptModal}
            onRefuse={openRefuseModal}
            onConfirm={openConfirmModal}
            onCancel={openCancelModal}
            onManualPayment={openManualPaymentModal}
            onRefundOnly={openRefundOnlyModal}
            onEmail={contactEmail}
            onPhone={contactPhone}
            onSms={contactSms}
            onOpenCustomer={navigation.openCustomerFromReservation}
            onOpenCommunication={openCommunicationContext}
            onEdit={canManageOpenedReservation ? editReservation : undefined}
            onDelete={canManageOpenedReservation ? deleteReservation : undefined}
            onReservationUpdated={loadAdminData}
            permissions={permissions}
            mode="admin"
          />
        </section>
      )}

      {modal && <ActionModal modal={modal} onClose={() => setModal(null)} onSubmit={submitModal} />}
    </main>
  );
}
