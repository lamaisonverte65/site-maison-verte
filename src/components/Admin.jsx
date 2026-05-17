import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import CalendarAdmin from "./CalendarAdmin";
import AdminLogin from "./AdminLogin";

const STATUS_LABELS = {
  pending: "En attente",
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
  return [request.guest_first_name, request.guest_last_name].filter(Boolean).join(" ") || "Client sans nom";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export default function Admin() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

    setBookingRequests(requestsData || []);
    setCustomers(customersData || []);
    setLoading(false);
  }

  function hasDateConflict(currentRequest) {
    return bookingRequests.some((request) => {
      if (request.id === currentRequest.id) return false;
      if (!ACTIVE_BLOCKING_STATUSES.includes(request.status)) return false;
      return currentRequest.start_date < request.end_date && currentRequest.end_date > request.start_date;
    });
  }

  async function createCheckoutSession(request, ownerPrice) {
    const response = await fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const data = await response.json();
    return data.url;
  }

  async function sendDecisionEmail(request, type, ownerPrice, ownerMessage, extras = {}) {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const response = await fetch("/.netlify/functions/send-booking-decision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentSession?.access_token}`,
      },
      body: JSON.stringify({
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

  function openAcceptModal(request) {
    if (hasDateConflict(request)) {
      alert("Impossible d’accepter : une autre demande est déjà acceptée/payée/confirmée sur ces dates.");
      return;
    }
    setModal({
      type: "accept",
      request,
      title: "Accepter la demande",
      price: request.owner_price || request.estimated_total || "",
      message: "Votre demande est acceptée. La réservation sera confirmée après paiement des arrhes.",
      helper: "Un lien Stripe d’acompte de 30% sera créé et ajouté à l’email.",
      refund: false,
    });
  }

  function openRefuseModal(request) {
    setModal({
      type: "refuse",
      request,
      title: "Refuser la demande",
      message: "Nous sommes désolés, mais les dates demandées ne sont malheureusement pas disponibles.",
      helper: "Le client recevra ce message par email.",
    });
  }

  function openConfirmModal(request) {
    setModal({
      type: "confirm",
      request,
      title: "Confirmer la réservation",
      message: "Votre réservation est confirmée. Merci pour votre confiance.",
      helper: "Cette action reste disponible en secours manuel. Stripe pourra confirmer automatiquement.",
    });
  }

  function openCancelModal(request) {
    setModal({
      type: "cancel",
      request,
      title: "Annuler la réservation",
      message: "La réservation est annulée.",
      helper: "Choisis si un remboursement doit être noté. Le remboursement Stripe automatique sera ajouté plus tard.",
      refund: false,
    });
  }

  async function submitModal(values) {
    if (!modal) return;
    const request = modal.request;

    try {
      if (modal.type === "accept") {
        const proposedPrice = Number(values.price || 0);
        if (!proposedPrice || proposedPrice <= 0) {
          alert("Tarif invalide.");
          return;
        }
        const acceptanceExpiresAt = addHours(24);
        const paymentLink = await createCheckoutSession(request, proposedPrice);
        await sendDecisionEmail(request, "accepted", proposedPrice, values.message, { paymentLink, acceptanceExpiresAt });
        const discountAmount = Number(request.estimated_total || 0) - proposedPrice;
        const { error } = await supabase.from("booking_requests").update({
          status: "accepted",
          owner_price: proposedPrice,
          payment_link: paymentLink,
          acceptance_expires_at: acceptanceExpiresAt,
          discount_amount: discountAmount > 0 ? discountAmount : 0,
          discount_reason: discountAmount > 0 ? "Tarif spécial propriétaire" : null,
          owner_message: values.message,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);
        if (error) throw error;
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
        alert("Réservation confirmée.");
      }

      if (modal.type === "cancel") {
        const cancellationNote = values.refund
          ? `${values.message}\n\nRemboursement à prévoir / à vérifier.`
          : `${values.message}\n\nAucun remboursement automatique effectué.`;
        const { error } = await supabase.from("booking_requests").update({
          status: "cancelled",
          owner_message: cancellationNote,
          updated_at: new Date().toISOString(),
        }).eq("id", request.id);
        if (error) throw error;
        alert("Réservation annulée.");
      }

      setModal(null);
      await loadAdminData();
      setSelectedRequest(null);
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
    const list = target === "loyal" ? customers.filter((c) => Number(c.booking_count || 0) >= 2) : customers;
    const emails = list.map((c) => c.email).filter(Boolean);
    if (emails.length === 0) return alert("Aucun email disponible.");
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
  }

  function applyDashboardFilter(filter) {
    setActiveTab("requests");
    setStatusFilter(filter);
    setSelectedRequest(null);
  }

  const filteredRequests = useMemo(() => bookingRequests.filter((request) => {
    const status = request.status || "pending";
    const matchesStatus = statusFilter === "all" || status === statusFilter || (statusFilter === "paid_group" && ["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status));
    const text = [request.guest_first_name, request.guest_last_name, request.guest_email, request.guest_phone, request.start_date, request.end_date, request.source, request.message, request.owner_message, request.payment_status].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && text.includes(search.trim().toLowerCase());
  }), [bookingRequests, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => [customer.first_name, customer.last_name, customer.email, customer.phone, customer.source, customer.notes, customer.booking_count, customer.created_at, customer.last_stay].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
    return filtered.sort((a, b) => {
      const direction = customerSort.direction === "asc" ? 1 : -1;
      const aValue = a[customerSort.key] ?? "";
      const bValue = b[customerSort.key] ?? "";
      if (customerSort.key === "booking_count") return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
      return String(aValue).localeCompare(String(bValue), "fr", { numeric: true, sensitivity: "base" }) * direction;
    });
  }, [customers, search, customerSort]);

  const stats = useMemo(() => ({
    requests: bookingRequests.length,
    pending: bookingRequests.filter((r) => (r.status || "pending") === "pending").length,
    accepted: bookingRequests.filter((r) => r.status === "accepted").length,
    paid: bookingRequests.filter((r) => ["deposit_paid", "paid", "fully_paid", "confirmed"].includes(r.status)).length,
    confirmed: bookingRequests.filter((r) => r.status === "confirmed").length,
    loyal: customers.filter((c) => Number(c.booking_count || 0) >= 2).length,
  }), [bookingRequests, customers]);

  const paymentRows = useMemo(() => bookingRequests.filter((r) => ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed"].includes(r.status)).map((r) => ({
    id: r.id,
    name: getRequestName(r),
    status: r.status,
    amount: r.owner_price || r.estimated_total,
    paymentStatus: r.payment_status || "non configuré",
    startDate: r.start_date,
    endDate: r.end_date,
    paymentLink: r.payment_link,
    expiresAt: r.acceptance_expires_at,
  })), [bookingRequests]);

  if (authLoading) return <p style={{ padding: 30 }}>Chargement...</p>;
  if (!session) return <AdminLogin onLogin={checkSession} />;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div><p style={styles.kicker}>Administration</p><h1 style={styles.title}>La Maison Verte — Arreau</h1><p style={styles.subtitle}>Demandes, clients, calendrier, paiements et CRM.</p></div>
        <div style={styles.headerActions}><button style={styles.refreshButton} onClick={loadAdminData}>Actualiser</button><button style={styles.logoutButton} onClick={handleLogout}>Déconnexion</button></div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Demandes" value={stats.requests} onClick={() => applyDashboardFilter("all")} />
        <StatCard label="En attente" value={stats.pending} onClick={() => applyDashboardFilter("pending")} />
        <StatCard label="Acceptées" value={stats.accepted} onClick={() => applyDashboardFilter("accepted")} />
        <StatCard label="Payées / confirmées" value={stats.paid} onClick={() => applyDashboardFilter("paid_group")} />
        <StatCard label="Confirmées" value={stats.confirmed} onClick={() => applyDashboardFilter("confirmed")} />
        <StatCard label="Clients fidèles" value={stats.loyal} onClick={() => setActiveTab("customers")} />
      </section>

      <section style={styles.toolbar}><input style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, email, téléphone, dates, notes..." /><select style={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="pending">En attente</option><option value="accepted">Acceptée</option><option value="deposit_paid">Acompte payé</option><option value="paid_group">Payées / confirmées</option><option value="confirmed">Confirmée</option><option value="refused">Refusée</option><option value="expired">Expirée</option><option value="cancelled">Annulée</option></select></section>

      <nav style={styles.tabs}><button style={activeTab === "requests" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("requests")}>Demandes</button><button style={activeTab === "customers" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("customers")}>Clients</button><button style={activeTab === "calendar" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("calendar")}>Calendrier</button><button style={activeTab === "payments" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("payments")}>Paiements</button></nav>

      {loading && <p style={styles.info}>Chargement des données...</p>}
      {error && <p style={styles.error}>Erreur Supabase : {error}</p>}

      {!loading && !error && activeTab === "requests" && <section style={styles.contentGrid}><div style={styles.panel}><h2 style={styles.panelTitle}>Demandes de réservation</h2>{filteredRequests.length === 0 ? <p style={styles.empty}>Aucune demande trouvée.</p> : <div style={styles.list}>{filteredRequests.map((request) => <button key={request.id} style={selectedRequest?.id === request.id ? styles.selectedListItem : styles.listItem} onClick={() => setSelectedRequest(request)}><div style={styles.listItemTop}><strong>{getRequestName(request)}</strong><StatusBadge status={request.status || "pending"} /></div><div style={styles.muted}>{formatDate(request.start_date)} → {formatDate(request.end_date)}</div><div style={styles.muted}>{request.guest_email || "Email non renseigné"}</div><div style={styles.price}>{request.owner_price ? `${request.owner_price} € proposés` : request.estimated_total ? `${request.estimated_total} € estimés` : "Prix à confirmer"}</div></button>)}</div>}</div><div style={styles.panel}><h2 style={styles.panelTitle}>Consultation rapide</h2>{!selectedRequest ? <p style={styles.empty}>Sélectionne une demande pour voir le détail.</p> : <RequestDetail request={selectedRequest} onAccept={openAcceptModal} onRefuse={openRefuseModal} onConfirm={openConfirmModal} onCancel={openCancelModal} onEmail={contactEmail} onPhone={contactPhone} onSms={contactSms} />}</div></section>}

      {!loading && !error && activeTab === "customers" && <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>Clients</h2><div style={styles.headerActions}><button style={styles.addButton} onClick={() => bulkEmail("all")}>Email tous les clients</button><button style={styles.addButton} onClick={() => bulkEmail("loyal")}>Email clients fidèles</button><button style={styles.addButton} onClick={addCustomer}>Ajouter client</button></div></div>{filteredCustomers.length === 0 ? <p style={styles.empty}>Aucun client trouvé.</p> : <div style={styles.tableWrapper}><table style={styles.table}><thead style={styles.stickyHead}><tr><SortableTh label="Nom" sortKey="last_name" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Prénom" sortKey="first_name" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Téléphone" sortKey="phone" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Email" sortKey="email" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Source" sortKey="source" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Réservations" sortKey="booking_count" sort={customerSort} onSort={handleCustomerSort} /><th style={styles.th}>Notes</th><th style={styles.th}>Contact</th><th style={styles.th}>Actions</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><EditableTd value={customer.last_name} onClick={() => updateCustomerField(customer.id, "last_name", customer.last_name)} /><EditableTd value={customer.first_name} onClick={() => updateCustomerField(customer.id, "first_name", customer.first_name)} /><EditableTd value={customer.phone} onClick={() => updateCustomerField(customer.id, "phone", customer.phone)} /><EditableTd value={customer.email} onClick={() => updateCustomerField(customer.id, "email", customer.email)} /><EditableTd value={customer.source} onClick={() => updateCustomerField(customer.id, "source", customer.source)} /><EditableTd value={customer.booking_count ?? 0} onClick={() => updateCustomerBookingCount(customer.id, customer.booking_count)} /><EditableTd value={customer.notes} onClick={() => updateCustomerField(customer.id, "notes", customer.notes)} /><td style={styles.td}><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => contactEmail(customer.email)}>Email</button><button style={styles.smallButton} onClick={() => contactPhone(customer.phone)}>Appel</button><button style={styles.smallButton} onClick={() => contactSms(customer.phone)}>SMS</button></div></td><td style={styles.td}><button style={styles.deleteButton} onClick={() => deleteCustomer(customer)}>Supprimer</button></td></tr>)}</tbody></table></div>}</section>}

      {!loading && !error && activeTab === "calendar" && <section style={styles.panel}><h2 style={styles.panelTitle}>Calendrier central</h2><CalendarAdmin /></section>}

      {!loading && !error && activeTab === "payments" && <section style={styles.panel}><h2 style={styles.panelTitle}>Paiements</h2><div style={styles.tableWrapper}><table style={styles.table}><thead style={styles.stickyHead}><tr><th style={styles.th}>Client</th><th style={styles.th}>Dates</th><th style={styles.th}>Statut réservation</th><th style={styles.th}>Statut paiement</th><th style={styles.th}>Montant</th><th style={styles.th}>Expiration paiement</th><th style={styles.th}>Lien</th></tr></thead><tbody>{paymentRows.map((row) => <tr key={row.id}><td style={styles.td}>{row.name}</td><td style={styles.td}>{formatDate(row.startDate)} → {formatDate(row.endDate)}</td><td style={styles.td}><StatusBadge status={row.status} /></td><td style={styles.td}>{row.paymentStatus}</td><td style={styles.td}>{row.amount ? `${row.amount} €` : "-"}</td><td style={styles.td}>{formatDateTime(row.expiresAt)}</td><td style={styles.td}>{row.paymentLink ? <a href={row.paymentLink} target="_blank" rel="noreferrer">Stripe</a> : "-"}</td></tr>)}</tbody></table></div></section>}

      {modal && <ActionModal modal={modal} onClose={() => setModal(null)} onSubmit={submitModal} />}
    </main>
  );
}

function RequestDetail({ request, onAccept, onRefuse, onConfirm, onCancel, onEmail, onPhone, onSms }) {
  const status = request.status || "pending";
  return <div style={styles.detail}><div style={styles.detailHeader}><div><h3 style={styles.detailTitle}>{getRequestName(request)}</h3><p style={styles.muted}>{request.guest_email}</p></div><StatusBadge status={status} /></div><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => onEmail(request.guest_email)}>Email</button><button style={styles.smallButton} onClick={() => onPhone(request.guest_phone)}>Appel</button><button style={styles.smallButton} onClick={() => onSms(request.guest_phone)}>SMS</button></div><div style={styles.detailGrid}><Info label="Téléphone" value={request.guest_phone} /><Info label="Arrivée" value={formatDate(request.start_date)} /><Info label="Départ" value={formatDate(request.end_date)} /><Info label="Nuits" value={request.nights} /><Info label="Prix estimatif" value={request.estimated_total ? `${request.estimated_total} €` : "-"} /><Info label="Prix proposé" value={request.owner_price ? `${request.owner_price} €` : "-"} /><Info label="Statut paiement" value={request.payment_status || "non configuré"} /><Info label="Expiration paiement" value={formatDateTime(request.acceptance_expires_at)} /><Info label="Heure d’arrivée" value={request.arrival_time || "à renseigner"} /><Info label="Créée le" value={formatDateTime(request.created_at)} /></div>{request.message && <div style={styles.noteBox}><strong>Message client</strong><p>{request.message}</p></div>}{request.owner_message && <div style={styles.noteBox}><strong>Dernier message propriétaire</strong><p>{request.owner_message}</p></div>}<div style={styles.actions}>{status === "pending" && <><button style={styles.acceptButton} onClick={() => onAccept(request)}>Accepter</button><button style={styles.refuseButton} onClick={() => onRefuse(request)}>Refuser</button><button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button></>}{status === "accepted" && <><button style={styles.confirmButton} onClick={() => onConfirm(request)}>Confirmer manuellement</button><button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button></>}{["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status) && <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button>}{["refused", "expired", "cancelled"].includes(status) && <p style={styles.empty}>Aucune action disponible : dossier conservé dans l’historique.</p>}</div></div>;
}

function ActionModal({ modal, onClose, onSubmit }) {
  const [price, setPrice] = useState(modal.price || "");
  const [message, setMessage] = useState(modal.message || "");
  const [refund, setRefund] = useState(false);
  function submit(event) { event.preventDefault(); onSubmit({ price, message, refund }); }
  return <div style={styles.modalOverlay}><form style={styles.modal} onSubmit={submit}><div style={styles.modalHeader}><h2 style={{ margin: 0 }}>{modal.title}</h2><button type="button" style={styles.closeButton} onClick={onClose}>×</button></div><p style={styles.empty}>{modal.helper}</p>{modal.type === "accept" && <label style={styles.label}>Tarif proposé (€)<input style={styles.input} value={price} onChange={(e) => setPrice(e.target.value)} /></label>}<label style={styles.label}>Message envoyé au client / note interne<textarea style={styles.largeTextarea} value={message} onChange={(e) => setMessage(e.target.value)} /></label>{modal.type === "cancel" && <label style={styles.checkboxLine}><input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />Noter qu’un remboursement doit être étudié/effectué</label>}<div style={styles.modalActions}><button type="button" style={styles.cancelButton} onClick={onClose}>Retour</button><button type="submit" style={styles.acceptButton}>Valider</button></div></form></div>;
}

function StatCard({ label, value, onClick }) { return <button style={styles.statCard} onClick={onClick}><span style={styles.statLabel}>{label}</span><strong style={styles.statValue}>{value}</strong></button>; }
function StatusBadge({ status }) { return <span style={{ ...styles.badge, backgroundColor: STATUS_COLORS[status] || "#6b7280" }}>{STATUS_LABELS[status] || status}</span>; }
function Info({ label, value }) { return <div style={styles.infoItem}><span>{label}</span><strong>{value || "-"}</strong></div>; }
function SortableTh({ label, sortKey, sort, onSort }) { const active = sort.key === sortKey; const arrow = active ? (sort.direction === "asc" ? " ↑" : " ↓") : ""; return <th style={styles.th}><button style={styles.thButton} onClick={() => onSort(sortKey)}>{label}{arrow}</button></th>; }
function EditableTd({ value, onClick }) { return <td style={styles.td} onClick={onClick} title="Cliquer pour modifier">{value || "-"}</td>; }

const styles = {
  page:{minHeight:"100vh",padding:"32px",background:"#f3f0e8",color:"#1f2933",fontFamily:"Inter, system-ui, sans-serif"},header:{display:"flex",justifyContent:"space-between",gap:"24px",alignItems:"center",marginBottom:"28px",flexWrap:"wrap"},headerActions:{display:"flex",gap:"10px",flexWrap:"wrap"},kicker:{margin:0,color:"#4f6f52",textTransform:"uppercase",letterSpacing:"0.12em",fontSize:"12px",fontWeight:700},title:{margin:"6px 0",fontSize:"clamp(28px, 4vw, 44px)"},subtitle:{margin:0,color:"#64748b"},refreshButton:{border:"none",borderRadius:"999px",padding:"12px 18px",background:"#2f4f35",color:"white",fontWeight:700,cursor:"pointer"},logoutButton:{border:"none",borderRadius:"999px",padding:"12px 18px",background:"#dc2626",color:"white",fontWeight:700,cursor:"pointer"},statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"16px",marginBottom:"22px"},statCard:{textAlign:"left",border:"none",background:"white",borderRadius:"22px",padding:"20px",boxShadow:"0 12px 30px rgba(0,0,0,0.08)",cursor:"pointer"},statLabel:{color:"#64748b",fontSize:"14px"},statValue:{display:"block",fontSize:"30px",marginTop:"8px"},toolbar:{display:"flex",gap:"12px",marginBottom:"18px",flexWrap:"wrap"},searchInput:{flex:"1 1 280px",padding:"14px 16px",borderRadius:"16px",border:"1px solid #d6d3c8",fontSize:"15px"},select:{padding:"14px 16px",borderRadius:"16px",border:"1px solid #d6d3c8",background:"white"},tabs:{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"20px"},tab:{border:"1px solid #d6d3c8",background:"white",borderRadius:"999px",padding:"10px 16px",cursor:"pointer"},activeTab:{border:"1px solid #2f4f35",background:"#2f4f35",color:"white",borderRadius:"999px",padding:"10px 16px",cursor:"pointer"},contentGrid:{display:"grid",gridTemplateColumns:"minmax(0, 1fr) minmax(320px, 0.8fr)",gap:"20px"},panel:{background:"white",borderRadius:"28px",padding:"22px",boxShadow:"0 12px 30px rgba(0,0,0,0.08)"},panelHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"},panelTitle:{marginTop:0,marginBottom:"18px"},list:{display:"grid",gap:"12px"},listItem:{textAlign:"left",border:"1px solid #e5e7eb",background:"#fff",borderRadius:"18px",padding:"16px",cursor:"pointer"},selectedListItem:{textAlign:"left",border:"2px solid #2f4f35",background:"#f6fbf6",borderRadius:"18px",padding:"16px",cursor:"pointer"},listItemTop:{display:"flex",justifyContent:"space-between",gap:"10px",alignItems:"center",marginBottom:"8px"},badge:{color:"white",borderRadius:"999px",padding:"5px 10px",fontSize:"12px",fontWeight:700,whiteSpace:"nowrap"},muted:{color:"#64748b",fontSize:"14px",margin:"4px 0"},price:{marginTop:"8px",fontWeight:800},detail:{display:"grid",gap:"18px"},detailHeader:{display:"flex",justifyContent:"space-between",gap:"16px"},detailTitle:{margin:0,fontSize:"22px"},detailGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"12px"},infoItem:{background:"#f8fafc",borderRadius:"16px",padding:"14px"},noteBox:{background:"#f8fafc",borderRadius:"16px",padding:"16px",lineHeight:1.5},actions:{display:"flex",gap:"10px",flexWrap:"wrap"},acceptButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#16a34a",color:"white",cursor:"pointer"},refuseButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#dc2626",color:"white",cursor:"pointer"},confirmButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#15803d",color:"white",cursor:"pointer"},cancelButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#6b7280",color:"white",cursor:"pointer"},addButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#2f4f35",color:"white",cursor:"pointer"},smallButton:{border:"none",borderRadius:"999px",padding:"7px 10px",background:"#e2e8f0",cursor:"pointer",whiteSpace:"nowrap"},contactButtons:{display:"flex",gap:"8px",flexWrap:"wrap"},tableWrapper:{overflowX:"auto",maxHeight:"70vh",border:"1px solid #e5e7eb",borderRadius:"18px"},table:{minWidth:"1200px",width:"100%",borderCollapse:"collapse",fontSize:"14px"},stickyHead:{position:"sticky",top:0,background:"white",zIndex:2},th:{textAlign:"left",padding:"12px",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap",background:"white"},thButton:{border:"none",background:"transparent",fontWeight:800,cursor:"pointer",padding:0},td:{padding:"12px",borderBottom:"1px solid #e5e7eb",cursor:"pointer",verticalAlign:"top"},deleteButton:{border:"none",borderRadius:"999px",background:"#dc2626",color:"white",padding:"8px 12px",cursor:"pointer"},empty:{color:"#64748b",lineHeight:1.6},info:{background:"white",padding:"20px",borderRadius:"18px"},error:{background:"#fee2e2",color:"#991b1b",padding:"20px",borderRadius:"18px"},modalOverlay:{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:"20px"},modal:{background:"white",width:"100%",maxWidth:"720px",borderRadius:"28px",padding:"24px",boxShadow:"0 20px 60px rgba(0,0,0,0.25)",maxHeight:"90vh",overflowY:"auto"},modalHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",marginBottom:"12px"},closeButton:{border:"none",background:"#e5e7eb",borderRadius:"999px",width:"36px",height:"36px",cursor:"pointer",fontSize:"22px"},label:{display:"grid",gap:"8px",fontWeight:700,marginTop:"16px"},input:{padding:"12px 14px",borderRadius:"14px",border:"1px solid #d1d5db",fontSize:"15px"},largeTextarea:{minHeight:"220px",padding:"14px",borderRadius:"16px",border:"1px solid #d1d5db",fontSize:"15px",resize:"vertical",lineHeight:1.5},checkboxLine:{display:"flex",gap:"10px",alignItems:"center",marginTop:"16px"},modalActions:{display:"flex",justifyContent:"flex-end",gap:"10px",marginTop:"20px",flexWrap:"wrap"}
};
