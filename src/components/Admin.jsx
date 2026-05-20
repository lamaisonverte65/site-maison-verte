import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import CalendarAdmin from "./CalendarAdmin";
import PricingAdmin from "./PricingAdmin";
import AdminLogin from "./AdminLogin";

const STATUS_LABELS = {
  pending: "À confirmer",
  accepted: "Acceptée",
  deposit_paid: "Acompte payé",
  paid: "Payée",
  fully_paid: "Séjour soldé",
  confirmed: "Confirmée",
  refused: "Refusée",
  cancelled: "Annulée",
  expired: "Expirée",
};

const STATUS_COLORS = {
  pending: "#f59e0b",
  accepted: "#f97316",
  deposit_paid: "#2563eb",
  paid: "#14532d",
  fully_paid: "#052e16",
  confirmed: "#15803d",
  refused: "#dc2626",
  cancelled: "#6b7280",
  expired: "#7f1d1d",
};

const ACTIVE_BLOCKING_STATUSES = ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed"];

function getRequestName(request) {
  return [request?.guest_first_name, request?.guest_last_name].filter(Boolean).join(" ") || "Client sans nom";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function shortId(id) {
  return id ? String(id).slice(0, 8).toUpperCase() : "-";
}

function getAmounts(request) {
  const total = Number(request?.owner_price || request?.estimated_total || 0);
  const deposit = Number(request?.deposit_amount || Math.round(total * 0.3) || 0);
  const balance = Number(request?.balance_amount || Math.max(total - deposit, 0));
  const amountPaid = Number(request?.amount_paid || request?.total_paid || 0);

  let derivedPaid = amountPaid;
  if (!derivedPaid && ["deposit_paid", "paid"].includes(request?.status)) derivedPaid = deposit;
  if (!derivedPaid && ["fully_paid", "confirmed"].includes(request?.status)) derivedPaid = total;

  return { total, deposit, balance, paid: derivedPaid };
}

function getDepositStatus(request) {
  if (request?.deposit_status) return request.deposit_status;
  if (["refused", "expired"].includes(request?.status)) return "annulé";
  if (request?.status === "cancelled") return "annulé / à vérifier";
  if (["deposit_paid", "paid", "fully_paid", "confirmed"].includes(request?.status)) return "payé";
  if (request?.status === "accepted") return "à payer";
  return "en attente";
}

function getBalanceStatus(request) {
  if (request?.balance_status) return request.balance_status;
  if (["fully_paid", "confirmed"].includes(request?.status)) return "payé";
  if (request?.status === "cancelled") return "annulé / à vérifier";
  if (request?.status === "deposit_paid" || request?.status === "paid") return "en attente J-30";
  return "non demandé";
}

export default function Admin() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [bookingEvents, setBookingEvents] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [customerSort, setCustomerSort] = useState({ key: "last_name", direction: "asc" });
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadAdminData();
  }, [session]);

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

    const { data: requestsData, error: requestsError } = await supabase
      .from("booking_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestsError) {
      setError(requestsError.message);
      setLoading(false);
      return;
    }

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (customersError) {
      setError(customersError.message);
      setLoading(false);
      return;
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

    const nextRequests = requestsData || [];
    setBookingRequests(nextRequests);
    setCustomers(customersData || []);
    setPayments(paymentsData || []);
    setBookingEvents(eventsData || []);
    setEmailLogs(emailLogsData || []);
    setSelectedRequest((current) => current ? nextRequests.find((request) => request.id === current.id) || current : current);
    setLoading(false);
  }

  function selectReservation(request) {
    setSelectedRequest(request);
    setActiveTab("reservations");
  }

  function closeReservation() {
    setSelectedRequest(null);
  }

  async function logBookingEvent(bookingId, eventType, label, message, metadata = {}) {
    if (!bookingId) return;
    const { error } = await supabase.from("booking_events").insert([{
      booking_request_id: bookingId,
      event_type: eventType,
      label,
      message,
      metadata,
    }]);
    if (error) console.error("Erreur historique action :", error.message);
  }

  function hasDateConflict(currentRequest) {
    return bookingRequests.some((request) => {
      if (request.id === currentRequest.id) return false;
      if (!ACTIVE_BLOCKING_STATUSES.includes(request.status)) return false;
      return currentRequest.start_date < request.end_date && currentRequest.end_date > request.start_date;
    });
  }


  async function getAdminFetchHeaders() {
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      ...(currentSession?.access_token
        ? { Authorization: `Bearer ${currentSession.access_token}` }
        : {}),
    };
  }

  async function createCheckoutSession(request, ownerPrice) {
    const response = await fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: await getAdminFetchHeaders(),
      body: JSON.stringify({
        bookingId: request.id,
        guestFirstName: request.guest_first_name,
        guestLastName: request.guest_last_name,
        guestEmail: request.guest_email,
        startDate: request.start_date,
        endDate: request.end_date,
        ownerPrice,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  }

  async function sendDecisionEmail(request, type, ownerPrice, ownerMessage, extras = {}) {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const response = await fetch("/.netlify/functions/send-booking-decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
      },
      body: JSON.stringify({
        bookingId: request.id,
        type,
        guestEmail: request.guest_email,
        guestFirstName: request.guest_first_name,
        guestLastName: request.guest_last_name,
        startDate: request.start_date,
        endDate: request.end_date,
        nights: request.nights,
        estimatedTotal: request.estimated_total,
        ownerPrice,
        ownerMessage,
        arrivalTime: request.arrival_time,
        ...extras,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
  }


  async function createManualPayment(request, amount, reason, message) {
    const response = await fetch("/.netlify/functions/create-manual-payment-session", {
      method: "POST",
      headers: await getAdminFetchHeaders(),
      body: JSON.stringify({
        bookingId: request.id,
        guestEmail: request.guest_email,
        guestFirstName: request.guest_first_name,
        guestLastName: request.guest_last_name,
        startDate: request.start_date,
        endDate: request.end_date,
        amount,
        reason,
        message,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  }

  async function refundBookingPayment(request, values) {
    const response = await fetch("/.netlify/functions/refund-booking-payment", {
      method: "POST",
      headers: await getAdminFetchHeaders(),
      body: JSON.stringify({
        bookingId: request.id,
        action: values.action || "cancel_refund",
        refundOnly: values.refundOnly || false,
        cancellationType: values.cancellationType,
        refundMode: values.refundMode,
        refundAmount: values.refundAmount,
        message: values.message,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    return await response.json();
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
        const checkoutSession = await createCheckoutSession(request, proposedPrice);
        const paymentLink = checkoutSession.url;
        const paymentType = checkoutSession.paymentType || (daysUntil(request.start_date) !== null && daysUntil(request.start_date) <= 30 ? "full" : "deposit");
        const paymentAmount = checkoutSession.amount;
        const daysBeforeArrival = daysUntil(request.start_date);

        await sendDecisionEmail(request, "accepted", proposedPrice, values.message, {
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
        await logBookingEvent(request.id, "booking_accepted", "Demande acceptée", `Lien de paiement envoyé. Tarif proposé : ${proposedPrice} €`, { price: proposedPrice, paymentLink, paymentType });
        alert("Demande acceptée, lien Stripe créé et email envoyé.");
      }

      if (modal.type === "refuse") {
        await sendDecisionEmail(request, "refused", null, values.message);
        const { error } = await supabase.from("booking_requests").update({
          status: "refused",
          owner_message: values.message,
          refused_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);
        if (error) throw error;
        await logBookingEvent(request.id, "booking_refused", "Demande refusée", values.message, {});
        alert("Demande refusée et email envoyé.");
      }

      if (modal.type === "confirm") {
        await sendDecisionEmail(request, "confirmed", request.owner_price || request.estimated_total, values.message);
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
        await logBookingEvent(request.id, "booking_confirmed_manual", "Réservation confirmée manuellement", values.message, {});
        alert("Réservation confirmée.");
      }

      if (modal.type === "cancel") {
        const result = await refundBookingPayment(request, values);
        const refunded = Number(result.refundedAmount || 0);
        alert(refunded > 0
          ? `Réservation annulée et remboursement Stripe effectué : ${formatMoney(refunded)}.`
          : "Réservation annulée sans remboursement Stripe.");
      }

      if (modal.type === "refund_only") {
        const result = await refundBookingPayment(request, { ...values, action: "refund_only", refundOnly: true });
        const refunded = Number(result.refundedAmount || 0);
        alert(refunded > 0
          ? `Remboursement Stripe effectué sans annulation : ${formatMoney(refunded)}.`
          : "Aucun remboursement Stripe n’a été effectué.");
      }


      if (modal.type === "manual_payment") {
        const amount = Number(values.price || 0);
        if (!amount || amount <= 0) return alert("Montant invalide.");

        const payment = await createManualPayment(request, amount, values.reason || "solde", values.message);

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
        await logBookingEvent(request.id, "manual_payment_requested", "Lien de paiement manuel envoyé", `${values.reason || "autre"} · ${amount} €`, { amount, reason: values.reason || "autre", url: payment.url });
        alert("Lien de paiement créé et email envoyé au client.");
      }

      setModal(null);
      await loadAdminData();
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }

  async function updateCustomerField(customerId, field, currentValue) {
    const newValue = window.prompt(`Nouvelle valeur pour ${field} :`, currentValue || "");
    if (newValue === null) return;
    const { error } = await supabase.from("customers").update({ [field]: newValue }).eq("id", customerId);
    if (error) alert("Erreur : " + error.message);
    await loadAdminData();
  }

  async function updateCustomerBookingCount(customerId, currentValue) {
    const newValue = window.prompt("Nombre de réservations :", String(currentValue ?? 0));
    if (newValue === null) return;
    const parsed = Number.parseInt(newValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) return alert("Entre un nombre valide.");
    const { error } = await supabase.from("customers").update({ booking_count: parsed }).eq("id", customerId);
    if (error) alert("Erreur : " + error.message);
    await loadAdminData();
  }

  async function addCustomer() {
    const firstName = window.prompt("Prénom du client :");
    if (firstName === null) return;
    const lastName = window.prompt("Nom du client :");
    if (lastName === null) return;
    const phone = window.prompt("Téléphone :") || "";
    const email = window.prompt("Email :") || "";
    const notes = window.prompt("Notes :") || "";
    const { error } = await supabase.from("customers").insert([{ first_name: firstName || null, last_name: lastName || null, phone: phone || null, email: email || null, notes: notes || null, source: "admin", booking_count: 1 }]);
    if (error) return alert("Erreur : " + error.message);
    await loadAdminData();
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(`Supprimer le client ${customer.first_name || ""} ${customer.last_name || ""} ?`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) return alert("Erreur suppression : " + error.message);
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

  const filteredRequests = useMemo(() => bookingRequests.filter((request) => {
    const status = request.status || "pending";
    const matchesStatus = statusFilter === "all" || status === statusFilter || (statusFilter === "paid_group" && ["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status));
    const text = [request.id, request.guest_first_name, request.guest_last_name, request.guest_email, request.guest_phone, request.start_date, request.end_date, request.message, request.owner_message, request.payment_status, request.deposit_status, request.balance_status].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && text.includes(search.trim().toLowerCase());
  }), [bookingRequests, search, statusFilter]);

  const sortedReservations = useMemo(() => [...filteredRequests].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [filteredRequests]);

  const pendingRequests = useMemo(
    () => bookingRequests
      .filter((request) => (request.status || "pending") === "pending")
      .filter((request) => {
        const text = [
          request.id,
          request.guest_first_name,
          request.guest_last_name,
          request.guest_email,
          request.guest_phone,
          request.start_date,
          request.end_date,
          request.message,
        ].filter(Boolean).join(" ").toLowerCase();
        return text.includes(search.trim().toLowerCase());
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [bookingRequests, search]
  );

  const customerReservations = useMemo(() => {
    const map = new Map();
    for (const customer of customers) {
      const key = customer.id;
      const reservations = bookingRequests.filter((request) => {
        const sameEmail = customer.email && request.guest_email && customer.email.toLowerCase() === request.guest_email.toLowerCase();
        const samePhone = customer.phone && request.guest_phone && customer.phone.replace(/\s/g, "") === request.guest_phone.replace(/\s/g, "");
        const sameName = customer.first_name && customer.last_name && request.guest_first_name && request.guest_last_name &&
          customer.first_name.toLowerCase() === request.guest_first_name.toLowerCase() && customer.last_name.toLowerCase() === request.guest_last_name.toLowerCase();
        return sameEmail || samePhone || sameName;
      }).sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
      map.set(key, reservations);
    }
    return map;
  }, [customers, bookingRequests]);

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => {
      if (customerFilter === "loyal" && Number(customer.booking_count || 0) <= 1) return false;
      const text = [customer.first_name, customer.last_name, customer.email, customer.phone, customer.source, customer.notes, customer.booking_count, customer.created_at, customer.last_stay].filter(Boolean).join(" ").toLowerCase();
      return text.includes(search.trim().toLowerCase());
    });

    return filtered.sort((a, b) => {
      const direction = customerSort.direction === "asc" ? 1 : -1;
      const aValue = a[customerSort.key] ?? "";
      const bValue = b[customerSort.key] ?? "";
      if (customerSort.key === "booking_count") return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
      return String(aValue).localeCompare(String(bValue), "fr", { numeric: true, sensitivity: "base" }) * direction;
    });
  }, [customers, search, customerSort, customerFilter]);

  const stats = useMemo(() => ({
    requests: bookingRequests.length,
    pending: bookingRequests.filter((r) => (r.status || "pending") === "pending").length,
    accepted: bookingRequests.filter((r) => r.status === "accepted").length,
    paid: bookingRequests.filter((r) => ["deposit_paid", "paid", "fully_paid", "confirmed"].includes(r.status)).length,
    confirmed: bookingRequests.filter((r) => r.status === "confirmed" || r.status === "fully_paid").length,
    customers: customers.length,
    loyal: customers.filter((c) => Number(c.booking_count || 0) > 1).length,
  }), [bookingRequests, customers]);

  const paymentRows = useMemo(() => bookingRequests.filter((r) => ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed"].includes(r.status)).map((r) => ({
    id: r.id,
    name: getRequestName(r),
    status: r.status,
    amounts: getAmounts(r),
    paymentStatus: r.payment_status || "non configuré",
    depositStatus: getDepositStatus(r),
    balanceStatus: getBalanceStatus(r),
    startDate: r.start_date,
    endDate: r.end_date,
    paymentLink: r.payment_link,
    expiresAt: r.acceptance_expires_at,
  })), [bookingRequests]);

  const selectedPayments = useMemo(() => selectedRequest ? payments.filter((payment) => payment.booking_request_id === selectedRequest.id) : [], [payments, selectedRequest]);
  const selectedEvents = useMemo(() => selectedRequest ? bookingEvents.filter((item) => item.booking_request_id === selectedRequest.id) : [], [bookingEvents, selectedRequest]);
  const selectedEmailLogs = useMemo(() => selectedRequest ? emailLogs.filter((item) => item.booking_request_id === selectedRequest.id) : [], [emailLogs, selectedRequest]);

  if (authLoading) return <p style={{ padding: 30 }}>Chargement...</p>;
  if (!session) return <AdminLogin onLogin={checkSession} />;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>Administration</p>
          <h1 style={styles.title}>La Maison Verte — Arreau</h1>
          <p style={styles.subtitle}>Demandes en cours, réservations, clients, calendrier, paiements et CRM.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.refreshButton} onClick={loadAdminData}>Actualiser</button>
          <button style={styles.logoutButton} onClick={handleLogout}>Déconnexion</button>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Demandes" value={stats.pending} onClick={() => applyDashboardFilter("pending")} />
        <StatCard label="Réservations" value={stats.requests} onClick={() => applyDashboardFilter("all")} />
        <StatCard label="Acceptées" value={stats.accepted} onClick={() => applyDashboardFilter("accepted")} />
        <StatCard label="Payées / confirmées" value={stats.paid} onClick={() => applyDashboardFilter("paid_group")} />
        <StatCard label="Confirmées" value={stats.confirmed} onClick={() => applyDashboardFilter("confirmed")} />
        <StatCard label="Clients" value={stats.customers} onClick={() => { setCustomerFilter("all"); setActiveTab("customers"); }} />
        <StatCard label="Clients fidèles" value={stats.loyal} onClick={openLoyalCustomers} />
      </section>

      <section style={styles.toolbar}>
        <input style={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher nom, email, téléphone, dates, notes..." />
        <select style={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
      </section>

      <nav style={styles.tabs}>
        <button style={activeTab === "requests" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("requests")}>Demandes</button>
        <button style={activeTab === "reservations" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("reservations")}>Réservations</button>
        <button style={activeTab === "calendar" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("calendar")}>Calendrier</button>
        <button style={activeTab === "pricing" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("pricing")}>Tarifs</button>
        <button style={activeTab === "customers" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("customers")}>Clients</button>
        <button style={activeTab === "payments" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("payments")}>Paiements</button>
      </nav>

      {loading && <p style={styles.info}>Chargement des données...</p>}
      {error && <p style={styles.error}>Erreur Supabase : {error}</p>}

      {!loading && !error && activeTab === "requests" && (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Demandes en cours</h2>
            <button style={styles.smallButton} onClick={() => setActiveTab("reservations")}>Voir toutes les réservations</button>
          </div>

          {pendingRequests.length === 0 ? (
            <p style={styles.empty}>Aucune demande en attente.</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead style={styles.stickyHead}>
                  <tr>
                    <th style={styles.th}>N° demande</th>
                    <th style={styles.th}>Client</th>
                    <th style={styles.th}>Date demande</th>
                    <th style={styles.th}>Début séjour</th>
                    <th style={styles.th}>Fin séjour</th>
                    <th style={styles.th}>Nuits</th>
                    <th style={styles.th}>Total estimatif</th>
                    <th style={styles.th}>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((request) => (
                    <tr key={request.id} onClick={() => selectReservation(request)} style={selectedRequest?.id === request.id ? styles.selectedRow : styles.clickableRow}>
                      <td style={styles.td}>{shortId(request.id)}</td>
                      <td style={styles.td}>{getRequestName(request)}</td>
                      <td style={styles.td}>{formatDateTime(request.created_at)}</td>
                      <td style={styles.td}>{formatDate(request.start_date)}</td>
                      <td style={styles.td}>{formatDate(request.end_date)}</td>
                      <td style={styles.td}>{request.nights || "-"}</td>
                      <td style={styles.td}>{formatMoney(request.estimated_total)}</td>
                      <td style={styles.td}>{request.guest_email || request.guest_phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && !error && activeTab === "reservations" && (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Toutes les réservations</h2>
            {selectedRequest && <button style={styles.smallButton} onClick={closeReservation}>Fermer la fiche</button>}
          </div>

          {selectedRequest && (
            <div style={{ marginBottom: "24px" }}>
              <ReservationPanel
                request={selectedRequest}
                onAccept={openAcceptModal}
                onRefuse={openRefuseModal}
                onConfirm={openConfirmModal}
                onCancel={openCancelModal}
                onManualPayment={openManualPaymentModal}
                onRefundOnly={openRefundOnlyModal}
                onEmail={contactEmail}
                onPhone={contactPhone}
                onSms={contactSms}
                payments={selectedPayments}
                events={selectedEvents}
                emailLogs={selectedEmailLogs}
              />
            </div>
          )}

          <h3 style={{ marginTop: selectedRequest ? "22px" : 0 }}>Toutes les réservations</h3>
          {sortedReservations.length === 0 ? <p style={styles.empty}>Aucune réservation trouvée.</p> : <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead style={styles.stickyHead}>
                <tr>
                  <th style={styles.th}>N° résa</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Date demande</th>
                  <th style={styles.th}>Début séjour</th>
                  <th style={styles.th}>Fin séjour</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Acompte</th>
                  <th style={styles.th}>Solde</th>
                  <th style={styles.th}>Total payé</th>
                </tr>
              </thead>
              <tbody>
                {sortedReservations.map((request) => {
                  const amounts = getAmounts(request);
                  return <tr key={request.id} onClick={() => selectReservation(request)} style={selectedRequest?.id === request.id ? styles.selectedRow : styles.clickableRow}>
                    <td style={styles.td}>{shortId(request.id)}</td>
                    <td style={styles.td}>{getRequestName(request)}</td>
                    <td style={styles.td}>{formatDateTime(request.created_at)}</td>
                    <td style={styles.td}>{formatDate(request.start_date)}</td>
                    <td style={styles.td}>{formatDate(request.end_date)}</td>
                    <td style={styles.td}><StatusBadge status={request.status || "pending"} /></td>
                    <td style={styles.td}>{getDepositStatus(request)}<br /><span style={styles.muted}>{formatMoney(amounts.deposit)}</span></td>
                    <td style={styles.td}>{getBalanceStatus(request)}<br /><span style={styles.muted}>{formatMoney(amounts.balance)}</span></td>
                    <td style={styles.td}>{formatMoney(amounts.paid)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
        </section>
      )}

      {!loading && !error && activeTab === "calendar" && <section style={styles.panel}><h2 style={styles.panelTitle}>Calendrier central</h2><CalendarAdmin onSelectReservation={selectReservation} onCalendarUpdated={loadAdminData} /></section>}

      {!loading && !error && activeTab === "pricing" && <section style={styles.panel}><h2 style={styles.panelTitle}>Gestion des tarifs</h2><PricingAdmin /></section>}

      {!loading && !error && activeTab === "customers" && (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Clients {customerFilter === "loyal" ? "fidèles" : ""}</h2>
            <div style={styles.headerActions}>
              {customerFilter === "loyal" && <button style={styles.smallButton} onClick={() => setCustomerFilter("all")}>Voir tous les clients</button>}
              <button style={styles.addButton} onClick={() => bulkEmail("all")}>Email tous les clients</button>
              <button style={styles.addButton} onClick={() => bulkEmail("loyal")}>Email clients fidèles</button>
              <button style={styles.addButton} onClick={addCustomer}>Ajouter client</button>
            </div>
          </div>
          {filteredCustomers.length === 0 ? <p style={styles.empty}>Aucun client trouvé.</p> : <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead style={styles.stickyHead}>
                <tr>
                  <SortableTh label="Nom" sortKey="last_name" sort={customerSort} onSort={handleCustomerSort} />
                  <SortableTh label="Prénom" sortKey="first_name" sort={customerSort} onSort={handleCustomerSort} />
                  <SortableTh label="Téléphone" sortKey="phone" sort={customerSort} onSort={handleCustomerSort} />
                  <SortableTh label="Email" sortKey="email" sort={customerSort} onSort={handleCustomerSort} />
                  <SortableTh label="Réservations" sortKey="booking_count" sort={customerSort} onSort={handleCustomerSort} />
                  <th style={styles.th}>Historique réservations</th>
                  <th style={styles.th}>Notes</th>
                  <th style={styles.th}>Contact</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const history = customerReservations.get(customer.id) || [];
                  return <tr key={customer.id}>
                    <EditableTd value={customer.last_name} onClick={() => updateCustomerField(customer.id, "last_name", customer.last_name)} />
                    <EditableTd value={customer.first_name} onClick={() => updateCustomerField(customer.id, "first_name", customer.first_name)} />
                    <EditableTd value={customer.phone} onClick={() => updateCustomerField(customer.id, "phone", customer.phone)} />
                    <EditableTd value={customer.email} onClick={() => updateCustomerField(customer.id, "email", customer.email)} />
                    <EditableTd value={customer.booking_count ?? history.length ?? 0} onClick={() => updateCustomerBookingCount(customer.id, customer.booking_count)} />
                    <td style={styles.td}><div style={styles.chipList}>{history.length === 0 ? "-" : history.map((reservation) => <button key={reservation.id} style={styles.historyChip} onClick={() => selectReservation(reservation)}>{formatDate(reservation.start_date)} → {formatDate(reservation.end_date)}</button>)}</div></td>
                    <EditableTd value={customer.notes ? String(customer.notes).slice(0, 80) : ""} onClick={() => updateCustomerField(customer.id, "notes", customer.notes)} />
                    <td style={styles.td}><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => contactEmail(customer.email)}>Email</button><button style={styles.smallButton} onClick={() => contactPhone(customer.phone)}>Appel</button><button style={styles.smallButton} onClick={() => contactSms(customer.phone)}>SMS</button></div></td>
                    <td style={styles.td}><button style={styles.deleteButton} onClick={() => deleteCustomer(customer)}>Supprimer</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
        </section>
      )}

      {!loading && !error && activeTab === "payments" && (
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Paiements</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead style={styles.stickyHead}><tr><th style={styles.th}>Client</th><th style={styles.th}>Dates</th><th style={styles.th}>Statut réservation</th><th style={styles.th}>Acompte</th><th style={styles.th}>Solde</th><th style={styles.th}>Total payé</th><th style={styles.th}>Expiration acompte</th><th style={styles.th}>Lien</th></tr></thead>
              <tbody>{paymentRows.map((row) => <tr key={row.id}><td style={styles.td}>{row.name}</td><td style={styles.td}>{formatDate(row.startDate)} → {formatDate(row.endDate)}</td><td style={styles.td}><StatusBadge status={row.status} /></td><td style={styles.td}>{row.depositStatus}<br />{formatMoney(row.amounts.deposit)}</td><td style={styles.td}>{row.balanceStatus}<br />{formatMoney(row.amounts.balance)}</td><td style={styles.td}>{formatMoney(row.amounts.paid)}</td><td style={styles.td}>{formatDateTime(row.expiresAt)}</td><td style={styles.td}>{row.paymentLink ? <a href={row.paymentLink} target="_blank" rel="noreferrer">Stripe</a> : "-"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {modal && <ActionModal modal={modal} onClose={() => setModal(null)} onSubmit={submitModal} />}
    </main>
  );
}

function ReservationPanel({ request, onAccept, onRefuse, onConfirm, onCancel, onManualPayment, onRefundOnly, onEmail, onPhone, onSms, payments = [], events = [], emailLogs = [] }) {
  const status = request.status || "pending";
  const amounts = getAmounts(request);

  return (
    <div style={styles.reservationSheet}>
      <div style={styles.detailHeader}>
        <div>
          <h3 style={styles.detailTitle}>{getRequestName(request)}</h3>
          <p style={styles.muted}>Réservation n° {shortId(request.id)} · créée le {formatDateTime(request.created_at)}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div style={styles.contactButtons}>
        <button style={styles.smallButton} onClick={() => onEmail(request.guest_email)}>Email</button>
        <button style={styles.smallButton} onClick={() => onPhone(request.guest_phone)}>Appel</button>
        <button style={styles.smallButton} onClick={() => onSms(request.guest_phone)}>SMS</button>
        {request.payment_link && <a style={styles.linkButton} href={request.payment_link} target="_blank" rel="noreferrer">Lien Stripe acompte/total</a>}
        {request.balance_payment_link && <a style={styles.linkButton} href={request.balance_payment_link} target="_blank" rel="noreferrer">Lien solde</a>}
        {request.manual_payment_link && <a style={styles.linkButton} href={request.manual_payment_link} target="_blank" rel="noreferrer">Lien paiement manuel</a>}
      </div>

      <h3 style={styles.subTitle}>Client</h3>
      <div style={styles.detailGrid}>
        <Info label="Prénom" value={request.guest_first_name} />
        <Info label="Nom" value={request.guest_last_name} />
        <Info label="Email" value={request.guest_email} />
        <Info label="Téléphone" value={request.guest_phone} />
      </div>

      <h3 style={styles.subTitle}>Séjour</h3>
      <div style={styles.detailGrid}>
        <Info label="Arrivée" value={formatDate(request.start_date)} />
        <Info label="Départ" value={formatDate(request.end_date)} />
        <Info label="Nuits" value={request.nights} />
        <Info label="Heure d’arrivée" value={request.arrival_time || "à renseigner"} />
      </div>

      <h3 style={styles.subTitle}>Statuts & paiements</h3>
      <div style={styles.detailGrid}>
        <Info label="Statut demande" value={STATUS_LABELS[status] || status} />
        <Info label="Statut acompte" value={`${getDepositStatus(request)} — ${formatMoney(amounts.deposit)}`} />
        <Info label="Statut solde" value={`${getBalanceStatus(request)} — ${formatMoney(amounts.balance)}`} />
        <Info label="Paiement manuel" value={request.manual_payment_status ? `${request.manual_payment_status} — ${formatMoney(request.manual_payment_amount)}` : "-"} />
        <Info label="Total séjour" value={formatMoney(amounts.total)} />
        <Info label="Total payé" value={formatMoney(amounts.paid)} />
        <Info label="Total remboursé" value={formatMoney(request.refunded_amount || 0)} />
        <Info label="Dernier remboursement Stripe" value={request.stripe_refund_id || "-"} />
        <Info label="Expiration acompte" value={formatDateTime(request.acceptance_expires_at)} />
      </div>

      <h3 style={styles.subTitle}>Actions financières</h3>
      <div style={styles.financeActionsBox}>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "acompte")}>Demander acompte</button>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "solde")}>Demander solde</button>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "complement")}>Demander complément</button>
        <button style={styles.paymentButton} onClick={() => onManualPayment(request, "total")}>Demander paiement total</button>
        {amounts.paid > 0 && <button style={styles.refundButton} onClick={() => onRefundOnly(request)}>Remboursement simple</button>}
      </div>

      <h3 style={styles.subTitle}>Contrat</h3>
      <div style={styles.detailGrid}>
        <Info label="Contrat accepté" value={request.contract_accepted ? `Oui — ${formatDateTime(request.contract_accepted_at)}` : "Non / non renseigné"} />
        <Info label="Version contrat" value={request.contract_version || "-"} />
        {request.contract_url && <div style={styles.infoItem}><span>Contrat</span><a href={request.contract_url} target="_blank" rel="noreferrer">Voir le PDF</a></div>}
      </div>

      {request.message && <div style={styles.noteBox}><strong>Message client</strong><p>{request.message}</p></div>}
      {request.owner_message && <div style={styles.noteBox}><strong>Dernier message propriétaire</strong><p>{request.owner_message}</p></div>}
      {request.manual_payment_message && <div style={styles.noteBox}><strong>Dernier message paiement manuel</strong><p>{request.manual_payment_message}</p></div>}

      <HistorySection title="Historique paiements" empty="Aucun paiement historisé." items={payments} renderItem={(payment) => (
        <div>
          <strong>{formatDateTime(payment.paid_at || payment.created_at)} · {formatMoney(payment.amount)}</strong>
          <p style={styles.muted}>{payment.payment_type || "paiement"} · {payment.status || "-"}{payment.refunded_amount ? ` · remboursé : ${formatMoney(payment.refunded_amount)}` : ""}</p>
          {payment.stripe_payment_intent_id && <p style={styles.muted}>PaymentIntent : {payment.stripe_payment_intent_id}</p>}
        </div>
      )} />

      <HistorySection title="Historique actions" empty="Aucune action historisée." items={events} renderItem={(item) => (
        <div>
          <strong>{formatDateTime(item.created_at)} · {item.event_type}</strong>
          <p style={styles.muted}>{item.label || item.message || "-"}</p>
        </div>
      )} />

      <HistorySection title="Emails envoyés" empty="Aucun email historisé." items={emailLogs} renderItem={(email) => (
        <div>
          <strong>{formatDateTime(email.sent_at || email.created_at)} · {email.email_type}</strong>
          <p style={styles.muted}>{email.subject || "Sans objet"} · {email.to_email || "-"} · {email.status || "-"}</p>
          {email.error_message && <p style={styles.muted}>Erreur : {email.error_message}</p>}
        </div>
      )} />

      <div style={styles.actions}>
        {status === "pending" && (
          <>
            <button style={styles.acceptButton} onClick={() => onAccept(request)}>Accepter</button>
            <button style={styles.refuseButton} onClick={() => onRefuse(request)}>Refuser</button>
            <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button>
          </>
        )}
        {status === "accepted" && (
          <>
            <button style={styles.confirmButton} onClick={() => onConfirm(request)}>Confirmer manuellement</button>
            <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button>
          </>
        )}
        {["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status) && <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler / remboursement</button>}
        {["refused", "expired", "cancelled"].includes(status) && <p style={styles.empty}>Dossier conservé dans l’historique.</p>}
      </div>
    </div>
  );
}

function HistorySection({ title, empty, items, renderItem }) {
  return (
    <div style={styles.historyBox}>
      <h3 style={styles.subTitle}>{title}</h3>
      {!items || items.length === 0 ? (
        <p style={styles.empty}>{empty}</p>
      ) : (
        <div style={styles.historyList}>
          {items.map((item) => (
            <div key={item.id} style={styles.historyItem}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionModal({ modal, onClose, onSubmit }) {
  const [price, setPrice] = useState(modal.price || "");
  const [reason, setReason] = useState(modal.reason || "solde");
  const [message, setMessage] = useState(modal.message || "");
  const [refundMode, setRefundMode] = useState(modal.refundMode || "none");
  const [refundAmount, setRefundAmount] = useState(modal.refundAmount || "");
  const [cancellationType, setCancellationType] = useState(modal.cancellationType || "client");
  const [confirmed, setConfirmed] = useState(false);

  function submit(event) {
    event.preventDefault();
    onSubmit({ price, reason, message, refundMode, refundAmount, cancellationType, confirmed });
  }

  return (
    <div style={styles.modalOverlay}>
      <form style={styles.modal} onSubmit={submit}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0 }}>{modal.title}</h2>
          <button type="button" style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <p style={styles.empty}>{modal.helper}</p>

        {modal.type === "accept" && (
          <label style={styles.label}>Tarif proposé (€)<input style={styles.input} value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        )}

        {modal.type === "manual_payment" && (
          <>
            <label style={styles.label}>Montant à payer (€)<input style={styles.input} value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ex : 168" /></label>
            <label style={styles.label}>Motif du paiement<select style={styles.input} value={reason} onChange={(event) => setReason(event.target.value)}><option value="solde">Solde</option><option value="acompte">Acompte</option><option value="total">Paiement total / tarif promo</option><option value="complement">Complément</option></select></label>
          </>
        )}

        <label style={styles.label}>Message envoyé au client / note interne<textarea style={styles.largeTextarea} value={message} onChange={(event) => setMessage(event.target.value)} /></label>

        {(modal.type === "cancel" || modal.type === "refund_only") && (
          <>
            {modal.type === "cancel" && (
              <label style={styles.label}>
                Type d’annulation
                <select style={styles.input} value={cancellationType} onChange={(event) => setCancellationType(event.target.value)}>
                  <option value="client">Annulation client</option>
                  <option value="owner">Annulation propriétaire</option>
                </select>
              </label>
            )}

            <label style={styles.label}>
              Remboursement
              <select style={styles.input} value={refundMode} onChange={(event) => setRefundMode(event.target.value)}>
                {modal.type === "cancel" && <option value="policy">Calculer selon les conditions</option>}
                {modal.type === "cancel" && <option value="none">Aucun remboursement</option>}
                <option value="deposit">Rembourser l’acompte</option>
                <option value="balance">Rembourser le solde</option>
                <option value="total">Remboursement total</option>
                <option value="custom">Montant libre</option>
              </select>
            </label>

            {refundMode === "custom" && (
              <label style={styles.label}>
                Montant à rembourser (€)
                <input style={styles.input} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Ex : 72" />
              </label>
            )}
          </>
        )}

        <label style={styles.securityBox}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{modal.confirmText || "Je confirme cette action."}</span></label>

        <div style={styles.modalActions}>
          <button type="button" style={styles.cancelButton} onClick={onClose}>Retour</button>
          <button type="submit" style={styles.acceptButton}>Valider</button>
        </div>
      </form>
    </div>
  );
}

function StatCard({ label, value, onClick }) { return <button style={styles.statCard} onClick={onClick}><span style={styles.statLabel}>{label}</span><strong style={styles.statValue}>{value}</strong></button>; }
function StatusBadge({ status }) { return <span style={{ ...styles.badge, backgroundColor: STATUS_COLORS[status] || "#6b7280" }}>{STATUS_LABELS[status] || status}</span>; }
function Info({ label, value }) { return <div style={styles.infoItem}><span>{label}</span><strong>{value || "-"}</strong></div>; }
function SortableTh({ label, sortKey, sort, onSort }) { const active = sort.key === sortKey; const arrow = active ? (sort.direction === "asc" ? " ↑" : " ↓") : ""; return <th style={styles.th}><button style={styles.thButton} onClick={() => onSort(sortKey)}>{label}{arrow}</button></th>; }
function EditableTd({ value, onClick }) { return <td style={styles.td} onClick={onClick} title="Cliquer pour modifier">{value || "-"}</td>; }

const styles = {
  page:{minHeight:"100vh",padding:"32px",background:"#f3f0e8",color:"#1f2933",fontFamily:"Inter, system-ui, sans-serif"},header:{display:"flex",justifyContent:"space-between",gap:"24px",alignItems:"center",marginBottom:"28px",flexWrap:"wrap"},headerActions:{display:"flex",gap:"10px",flexWrap:"wrap"},kicker:{margin:0,color:"#4f6f52",textTransform:"uppercase",letterSpacing:"0.12em",fontSize:"12px",fontWeight:700},title:{margin:"6px 0",fontSize:"clamp(28px, 4vw, 44px)"},subtitle:{margin:0,color:"#64748b"},refreshButton:{border:"none",borderRadius:"999px",padding:"12px 18px",background:"#2f4f35",color:"white",fontWeight:700,cursor:"pointer"},logoutButton:{border:"none",borderRadius:"999px",padding:"12px 18px",background:"#dc2626",color:"white",fontWeight:700,cursor:"pointer"},statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"16px",marginBottom:"22px"},statCard:{textAlign:"left",border:"none",background:"white",borderRadius:"22px",padding:"20px",boxShadow:"0 12px 30px rgba(0,0,0,0.08)",cursor:"pointer"},statLabel:{color:"#64748b",fontSize:"14px"},statValue:{display:"block",fontSize:"30px",marginTop:"8px"},toolbar:{display:"flex",gap:"12px",marginBottom:"18px",flexWrap:"wrap"},searchInput:{flex:"1 1 280px",padding:"14px 16px",borderRadius:"16px",border:"1px solid #d6d3c8",fontSize:"15px"},select:{padding:"14px 16px",borderRadius:"16px",border:"1px solid #d6d3c8",background:"white"},tabs:{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"20px"},tab:{border:"1px solid #d6d3c8",background:"white",borderRadius:"999px",padding:"10px 16px",cursor:"pointer"},activeTab:{border:"1px solid #2f4f35",background:"#2f4f35",color:"white",borderRadius:"999px",padding:"10px 16px",cursor:"pointer"},panel:{background:"white",borderRadius:"28px",padding:"22px",boxShadow:"0 12px 30px rgba(0,0,0,0.08)"},panelHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"},panelTitle:{marginTop:0,marginBottom:"18px"},badge:{color:"white",borderRadius:"999px",padding:"5px 10px",fontSize:"12px",fontWeight:700,whiteSpace:"nowrap"},muted:{color:"#64748b",fontSize:"14px",margin:"4px 0"},tableWrapper:{overflowX:"auto",maxHeight:"70vh",border:"1px solid #e5e7eb",borderRadius:"18px"},table:{minWidth:"1200px",width:"100%",borderCollapse:"collapse",fontSize:"14px"},stickyHead:{position:"sticky",top:0,background:"white",zIndex:2},th:{textAlign:"left",padding:"12px",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap",background:"white"},thButton:{border:"none",background:"transparent",fontWeight:800,cursor:"pointer",padding:0},td:{padding:"12px",borderBottom:"1px solid #e5e7eb",cursor:"pointer",verticalAlign:"top"},clickableRow:{cursor:"pointer"},selectedRow:{cursor:"pointer",background:"#f0fdf4"},reservationSheet:{display:"grid",gap:"18px"},detailHeader:{display:"flex",justifyContent:"space-between",gap:"16px",flexWrap:"wrap"},detailTitle:{margin:0,fontSize:"26px"},subTitle:{margin:"6px 0 0",color:"#2f4f35"},detailGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"12px"},infoItem:{background:"#f8fafc",borderRadius:"16px",padding:"14px",display:"grid",gap:"5px"},noteBox:{background:"#f8fafc",borderRadius:"16px",padding:"16px",lineHeight:1.5},actions:{display:"flex",gap:"10px",flexWrap:"wrap",paddingTop:"8px"},acceptButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#16a34a",color:"white",cursor:"pointer"},refuseButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#dc2626",color:"white",cursor:"pointer"},confirmButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#15803d",color:"white",cursor:"pointer"},cancelButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#6b7280",color:"white",cursor:"pointer"},addButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#2f4f35",color:"white",cursor:"pointer"},smallButton:{border:"none",borderRadius:"999px",padding:"7px 10px",background:"#e2e8f0",cursor:"pointer",whiteSpace:"nowrap"},linkButton:{borderRadius:"999px",padding:"7px 10px",background:"#dbeafe",color:"#1d4ed8",textDecoration:"none",whiteSpace:"nowrap"},contactButtons:{display:"flex",gap:"8px",flexWrap:"wrap"},financeActionsBox:{display:"flex",gap:"10px",flexWrap:"wrap",padding:"14px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:"18px"},paymentButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#2563eb",color:"white",cursor:"pointer",fontWeight:700},refundButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#9333ea",color:"white",cursor:"pointer",fontWeight:700},chipList:{display:"flex",gap:"6px",flexWrap:"wrap"},historyChip:{border:"none",borderRadius:"999px",padding:"6px 9px",background:"#eef2ff",color:"#3730a3",cursor:"pointer"},deleteButton:{border:"none",borderRadius:"999px",background:"#dc2626",color:"white",padding:"8px 12px",cursor:"pointer"},empty:{color:"#64748b",lineHeight:1.6},info:{background:"white",padding:"20px",borderRadius:"18px"},error:{background:"#fee2e2",color:"#991b1b",padding:"20px",borderRadius:"18px"},historyBox:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:"18px",padding:"14px"},historyList:{display:"grid",gap:"10px"},historyItem:{background:"#f8fafc",borderRadius:"14px",padding:"12px",lineHeight:1.45},modalOverlay:{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:"20px"},modal:{background:"white",width:"100%",maxWidth:"760px",borderRadius:"28px",padding:"24px",boxShadow:"0 20px 60px rgba(0,0,0,0.25)",maxHeight:"90vh",overflowY:"auto"},modalHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",marginBottom:"12px"},closeButton:{border:"none",background:"#e5e7eb",borderRadius:"999px",width:"36px",height:"36px",cursor:"pointer",fontSize:"22px"},label:{display:"grid",gap:"8px",fontWeight:700,marginTop:"16px"},input:{padding:"12px 14px",borderRadius:"14px",border:"1px solid #d1d5db",fontSize:"15px"},largeTextarea:{minHeight:"220px",padding:"14px",borderRadius:"16px",border:"1px solid #d1d5db",fontSize:"15px",resize:"vertical",lineHeight:1.5},securityBox:{display:"flex",gap:"10px",alignItems:"flex-start",marginTop:"18px",padding:"14px",borderRadius:"16px",background:"#fff7ed",border:"1px solid #fed7aa",lineHeight:1.5},modalActions:{display:"flex",justifyContent:"flex-end",gap:"10px",marginTop:"20px",flexWrap:"wrap"}
};
