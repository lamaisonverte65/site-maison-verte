import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import CalendarAdmin from "./CalendarAdmin";
import AdminLogin from "./AdminLogin";

const STATUS_LABELS = { pending:"En attente", accepted:"Acceptée", refused:"Refusée", paid:"Payée", confirmed:"Confirmée", cancelled:"Annulée", expired:"Expirée" };
const STATUS_COLORS = { pending:"#f59e0b", accepted:"#16a34a", refused:"#dc2626", paid:"#2563eb", confirmed:"#15803d", cancelled:"#6b7280", expired:"#7f1d1d" };
const ACTIVE_BLOCKING_STATUSES = ["accepted", "paid", "confirmed"];

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

  useEffect(() => { if (session) loadAdminData(); }, [session]);

  useEffect(() => {
    function clearSelection(event) {
      if (!event.target.closest("[data-request-zone='true']")) setSelectedRequest(null);
    }
    document.addEventListener("click", clearSelection);
    return () => document.removeEventListener("click", clearSelection);
  }, []);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setAuthLoading(false);
  }

  async function handleLogout() { await supabase.auth.signOut(); setSession(null); }

  async function loadAdminData() {
    setLoading(true); setError("");
    const { data: requestsData, error: requestsError } = await supabase.from("booking_requests").select("*").order("created_at", { ascending:false });
    if (requestsError) { setError(requestsError.message); setLoading(false); return; }
    const { data: customersData, error: customersError } = await supabase.from("customers").select("*").order("created_at", { ascending:false });
    if (customersError) { setError(customersError.message); setLoading(false); return; }
    setBookingRequests(requestsData || []); setCustomers(customersData || []); setLoading(false);
  }

  function hasDateConflict(currentRequest) {
    return bookingRequests.some((request) => {
      if (request.id === currentRequest.id) return false;
      if (!ACTIVE_BLOCKING_STATUSES.includes(request.status)) return false;
      return currentRequest.start_date < request.end_date && currentRequest.end_date > request.start_date;
    });
  }

  async function sendDecisionEmail(request, type, ownerPrice, ownerMessage) {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const response = await fetch("/.netlify/functions/send-booking-decision", {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${currentSession?.access_token}` },
      body: JSON.stringify({ type, guestEmail:request.guest_email, guestFirstName:request.guest_first_name, guestLastName:request.guest_last_name, startDate:request.start_date, endDate:request.end_date, nights:request.nights, estimatedTotal:request.estimated_total, ownerPrice, ownerMessage })
    });
    if (!response.ok) throw new Error(await response.text());
  }

  async function acceptRequest(request) {
    if (hasDateConflict(request)) { alert("Impossible d’accepter : une autre demande est déjà acceptée/payée/confirmée sur ces dates."); return; }
    const proposedPrice = window.prompt("Tarif proposé au client (€) :", String(request.owner_price || request.estimated_total || ""));
    if (proposedPrice === null) return;
    const ownerMessage = window.prompt("Message à envoyer au client :", "Votre demande est acceptée. La réservation sera confirmée après validation finale et paiement des arrhes.");
    if (ownerMessage === null) return;
    try {
      await sendDecisionEmail(request, "accepted", proposedPrice, ownerMessage);
      const discountAmount = Number(request.estimated_total || 0) - Number(proposedPrice || 0);
      const { error } = await supabase.from("booking_requests").update({ status:"accepted", owner_price:Number(proposedPrice), discount_amount:discountAmount > 0 ? discountAmount : 0, discount_reason:discountAmount > 0 ? "Tarif spécial propriétaire" : null, owner_message:ownerMessage, accepted_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id", request.id);
      if (error) throw error;
      await loadAdminData(); setSelectedRequest({ ...request, status:"accepted", owner_price:Number(proposedPrice), owner_message:ownerMessage });
      alert("Demande acceptée et email envoyé au client.");
    } catch (error) { alert("Erreur : " + error.message); }
  }

  async function refuseRequest(request) {
    const ownerMessage = window.prompt("Message de refus à envoyer au client :", "Nous sommes désolés, mais les dates demandées ne sont malheureusement pas disponibles.");
    if (ownerMessage === null) return;
    try {
      await sendDecisionEmail(request, "refused", null, ownerMessage);
      const { error } = await supabase.from("booking_requests").update({ status:"refused", owner_message:ownerMessage, refused_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id", request.id);
      if (error) throw error;
      await loadAdminData(); setSelectedRequest({ ...request, status:"refused", owner_message:ownerMessage });
      alert("Demande refusée et email envoyé au client.");
    } catch (error) { alert("Erreur : " + error.message); }
  }

  async function confirmRequest(request) {
    if (hasDateConflict(request) && request.status !== "accepted") { alert("Impossible de confirmer : une autre réservation est déjà active sur ces dates."); return; }
    const ownerMessage = window.prompt("Message de confirmation à envoyer au client :", "Votre réservation est confirmée. Merci pour votre confiance.");
    if (ownerMessage === null) return;
    try {
      await sendDecisionEmail(request, "confirmed", request.owner_price || request.estimated_total, ownerMessage);
      const { error } = await supabase.from("booking_requests").update({ status:"confirmed", owner_message:ownerMessage, confirmed_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id", request.id);
      if (error) throw error;
      await supabase.from("booking_requests").update({ status:"expired", updated_at:new Date().toISOString() }).neq("id", request.id).in("status", ["pending", "accepted"]).lt("start_date", request.end_date).gt("end_date", request.start_date);
      await loadAdminData(); setSelectedRequest({ ...request, status:"confirmed", owner_message:ownerMessage });
      alert("Réservation confirmée. Les autres demandes chevauchantes ont été expirées.");
    } catch (error) { alert("Erreur : " + error.message); }
  }

  async function cancelRequest(request) {
    if (!window.confirm("Annuler cette demande/réservation ?")) return;
    const { error } = await supabase.from("booking_requests").update({ status:"cancelled", updated_at:new Date().toISOString() }).eq("id", request.id);
    if (error) { alert("Erreur : " + error.message); return; }
    await loadAdminData(); setSelectedRequest({ ...request, status:"cancelled" });
  }

  async function updateArrivalTime(request) {
    const value = window.prompt(
      "Heure d’arrivée prévue :",
      request.arrival_time || "16:00"
    );
    if (value === null) return;

    const { error } = await supabase
      .from("booking_requests")
      .update({
        arrival_time: value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      alert("Erreur : " + error.message);
      return;
    }

    await loadAdminData();
    setSelectedRequest({ ...request, arrival_time: value });
  }

  async function updateCustomerField(customerId, field, currentValue) {
    const newValue = window.prompt(`Nouvelle valeur pour ${field} :`, currentValue || "");
    if (newValue === null) return;
    const { error } = await supabase.from("customers").update({ [field]: newValue }).eq("id", customerId);
    if (error) { alert("Erreur : " + error.message); return; }
    await loadAdminData();
  }

  async function updateCustomerBookingCount(customerId, currentValue) {
    const newValue = window.prompt("Nombre de réservations :", String(currentValue ?? 0));
    if (newValue === null) return;
    const parsed = Number.parseInt(newValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) { alert("Entre un nombre valide."); return; }
    const { error } = await supabase.from("customers").update({ booking_count: parsed }).eq("id", customerId);
    if (error) { alert("Erreur : " + error.message); return; }
    await loadAdminData();
  }

  async function addCustomer() {
    const firstName = window.prompt("Prénom du client :"); if (firstName === null) return;
    const lastName = window.prompt("Nom du client :"); if (lastName === null) return;
    const phone = window.prompt("Téléphone :") || "";
    const email = window.prompt("Email :") || "";
    const notes = window.prompt("Notes :") || "";
    const { error } = await supabase.from("customers").insert([{ first_name:firstName || null, last_name:lastName || null, phone:phone || null, email:email || null, notes:notes || null, source:"admin", booking_count:1 }]);
    if (error) { alert("Erreur : " + error.message); return; }
    await loadAdminData();
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(`Supprimer le client ${customer.first_name || ""} ${customer.last_name || ""} ?`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) { alert("Erreur suppression : " + error.message); return; }
    await loadAdminData();
  }

  function handleCustomerSort(key) { setCustomerSort((previous) => previous.key === key ? { key, direction:previous.direction === "asc" ? "desc" : "asc" } : { key, direction:"asc" }); }
  function contactEmail(email) { if (email) window.location.href = `mailto:${email}`; }
  function contactPhone(phone) { if (phone) window.location.href = `tel:${phone}`; }
  function contactSms(phone) { if (phone) window.location.href = `sms:${phone}`; }
  function bulkEmail(target) {
    const list = target === "loyal" ? customers.filter((c) => Number(c.booking_count || 0) >= 2) : customers;
    const emails = list.map((c) => c.email).filter(Boolean);
    if (emails.length === 0) { alert("Aucun email disponible."); return; }
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
  }

  const filteredRequests = useMemo(() => bookingRequests.filter((request) => {
    const status = request.status || "pending";
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const text = [request.guest_first_name, request.guest_last_name, request.guest_email, request.guest_phone, request.start_date, request.end_date, request.source, request.message, request.notes].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && text.includes(search.trim().toLowerCase());
  }), [bookingRequests, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => [customer.first_name, customer.last_name, customer.email, customer.phone, customer.source, customer.notes, customer.booking_count, customer.created_at, customer.last_stay].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
    return filtered.sort((a,b) => {
      const direction = customerSort.direction === "asc" ? 1 : -1;
      const aValue = a[customerSort.key] ?? "";
      const bValue = b[customerSort.key] ?? "";
      if (customerSort.key === "booking_count") return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
      return String(aValue).localeCompare(String(bValue), "fr", { numeric:true, sensitivity:"base" }) * direction;
    });
  }, [customers, search, customerSort]);

  const stats = useMemo(() => ({
    requests:bookingRequests.length,
    pending:bookingRequests.filter((r) => (r.status || "pending") === "pending").length,
    accepted:bookingRequests.filter((r) => r.status === "accepted").length,
    paid:bookingRequests.filter((r) => r.status === "paid" || r.status === "confirmed").length,
    customers:customers.length,
    loyal:customers.filter((c) => Number(c.booking_count || 0) >= 2).length,
  }), [bookingRequests, customers]);

  const paymentRows = useMemo(() => bookingRequests.filter((r) => ["accepted", "paid", "confirmed"].includes(r.status)).map((r) => ({ id:r.id, name:getRequestName(r), email:r.guest_email, status:r.status, amount:r.owner_price || r.estimated_total, paymentStatus:r.payment_status || "non configuré", startDate:r.start_date, endDate:r.end_date })), [bookingRequests]);

  if (authLoading) return <p style={{ padding:30 }}>Chargement...</p>;
  if (!session) return <AdminLogin onLogin={checkSession} />;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div><p style={styles.kicker}>Administration</p><h1 style={styles.title}>La Maison Verte — Arreau</h1><p style={styles.subtitle}>Tableau de bord central : demandes, clients, calendrier, paiements et CRM.</p></div>
        <div style={styles.headerActions}><button style={styles.refreshButton} onClick={loadAdminData}>Actualiser</button><button style={styles.logoutButton} onClick={handleLogout}>Déconnexion</button></div>
      </section>

      <section style={styles.statsGrid}><StatCard label="Demandes" value={stats.requests} /><StatCard label="En attente" value={stats.pending} /><StatCard label="Acceptées" value={stats.accepted} /><StatCard label="Payées / confirmées" value={stats.paid} /><StatCard label="Clients" value={stats.customers} /><StatCard label="Clients fidèles" value={stats.loyal} /></section>

      <section style={styles.toolbar}><input style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, email, téléphone, dates, notes..." /><select style={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="pending">En attente</option><option value="accepted">Acceptée</option><option value="refused">Refusée</option><option value="expired">Expirée</option><option value="paid">Payée</option><option value="confirmed">Confirmée</option><option value="cancelled">Annulée</option></select></section>

      <nav style={styles.tabs}><button style={activeTab === "requests" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("requests")}>Demandes</button><button style={activeTab === "customers" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("customers")}>Clients</button><button style={activeTab === "calendar" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("calendar")}>Calendrier</button><button style={activeTab === "payments" ? styles.activeTab : styles.tab} onClick={() => setActiveTab("payments")}>Paiements</button></nav>
      {loading && <p style={styles.info}>Chargement des données...</p>}{error && <p style={styles.error}>Erreur Supabase : {error}</p>}

      {!loading && !error && activeTab === "requests" && <section style={styles.contentGrid} data-request-zone="true"><div style={styles.panel}><h2 style={styles.panelTitle}>Demandes de réservation</h2>{filteredRequests.length === 0 ? <p style={styles.empty}>Aucune demande trouvée.</p> : <div style={styles.list}>{filteredRequests.map((request) => <button key={request.id} style={selectedRequest?.id === request.id ? styles.selectedListItem : styles.listItem} onClick={(event) => { event.stopPropagation(); setSelectedRequest(request); }}><div style={styles.listItemTop}><strong>{getRequestName(request)}</strong><StatusBadge status={request.status || "pending"} /></div><div style={styles.muted}>{formatDate(request.start_date)} → {formatDate(request.end_date)}</div><div style={styles.muted}>{request.guest_email || "Email non renseigné"}</div><div style={styles.price}>{request.owner_price ? `${request.owner_price} € proposés` : request.estimated_total ? `${request.estimated_total} € estimés` : "Prix à confirmer"}</div></button>)}</div>}</div><div style={styles.panel}><h2 style={styles.panelTitle}>Consultation rapide</h2>{!selectedRequest ? <p style={styles.empty}>Sélectionne une demande pour voir le détail.</p> : <RequestDetail request={selectedRequest} onAccept={acceptRequest} onRefuse={refuseRequest} onConfirm={confirmRequest} onCancel={cancelRequest} onEmail={contactEmail} onPhone={contactPhone} onSms={contactSms} onArrivalTime={updateArrivalTime} />}</div></section>}

      {!loading && !error && activeTab === "customers" && <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}>Clients</h2><div style={styles.headerActions}><button style={styles.addButton} onClick={() => bulkEmail("all")}>Email tous les clients</button><button style={styles.addButton} onClick={() => bulkEmail("loyal")}>Email clients fidèles</button><button style={styles.addButton} onClick={addCustomer}>Ajouter client</button></div></div>{filteredCustomers.length === 0 ? <p style={styles.empty}>Aucun client trouvé.</p> : <div style={styles.tableWrapper}><table style={styles.table}><thead style={styles.stickyHead}><tr><SortableTh label="Nom" sortKey="last_name" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Prénom" sortKey="first_name" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Téléphone" sortKey="phone" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Email" sortKey="email" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Source" sortKey="source" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Réservations" sortKey="booking_count" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Créé le" sortKey="created_at" sort={customerSort} onSort={handleCustomerSort} /><SortableTh label="Dernier séjour" sortKey="last_stay" sort={customerSort} onSort={handleCustomerSort} /><th style={styles.th}>Notes</th><th style={styles.th}>Contact</th><th style={styles.th}>Actions</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><EditableTd value={customer.last_name} onClick={() => updateCustomerField(customer.id, "last_name", customer.last_name)} /><EditableTd value={customer.first_name} onClick={() => updateCustomerField(customer.id, "first_name", customer.first_name)} /><EditableTd value={customer.phone} onClick={() => updateCustomerField(customer.id, "phone", customer.phone)} /><EditableTd value={customer.email} onClick={() => updateCustomerField(customer.id, "email", customer.email)} /><EditableTd value={customer.source} onClick={() => updateCustomerField(customer.id, "source", customer.source)} /><EditableTd value={customer.booking_count ?? 0} onClick={() => updateCustomerBookingCount(customer.id, customer.booking_count)} /><td style={styles.td}>{formatDate(customer.created_at)}</td><td style={styles.td}>{formatDate(customer.last_stay)}</td><EditableTd value={customer.notes} onClick={() => updateCustomerField(customer.id, "notes", customer.notes)} /><td style={styles.td}><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => contactEmail(customer.email)}>Email</button><button style={styles.smallButton} onClick={() => contactPhone(customer.phone)}>Appel</button><button style={styles.smallButton} onClick={() => contactSms(customer.phone)}>SMS</button></div></td><td style={styles.td}><button style={styles.deleteButton} onClick={() => deleteCustomer(customer)}>Supprimer</button></td></tr>)}</tbody></table></div>}</section>}

      {!loading && !error && activeTab === "calendar" && <section style={styles.panel}><h2 style={styles.panelTitle}>Calendrier central</h2><CalendarAdmin /></section>}
      {!loading && !error && activeTab === "payments" && <section style={styles.panel}><h2 style={styles.panelTitle}>Paiements</h2><p style={styles.empty}>Section prête pour Stripe : montants proposés, statut paiement, lien paiement, confirmation automatique.</p><div style={styles.tableWrapper}><table style={styles.table}><thead style={styles.stickyHead}><tr><th style={styles.th}>Client</th><th style={styles.th}>Dates</th><th style={styles.th}>Statut réservation</th><th style={styles.th}>Statut paiement</th><th style={styles.th}>Montant</th><th style={styles.th}>Contact</th></tr></thead><tbody>{paymentRows.map((row) => <tr key={row.id}><td style={styles.td}>{row.name}</td><td style={styles.td}>{formatDate(row.startDate)} → {formatDate(row.endDate)}</td><td style={styles.td}><StatusBadge status={row.status} /></td><td style={styles.td}>{row.paymentStatus}</td><td style={styles.td}>{row.amount ? `${row.amount} €` : "-"}</td><td style={styles.td}><button style={styles.smallButton} onClick={() => contactEmail(row.email)}>Email</button></td></tr>)}</tbody></table></div></section>}
    </main>
  );
}

function RequestDetail({ request, onAccept, onRefuse, onConfirm, onCancel, onEmail, onPhone, onSms, onArrivalTime }) {
  const status = request.status || "pending";
  return <div style={styles.detail}><div style={styles.detailHeader}><div><h3 style={styles.detailTitle}>{getRequestName(request)}</h3><p style={styles.muted}>{request.guest_email}</p></div><StatusBadge status={status} /></div><div style={styles.contactButtons}><button style={styles.smallButton} onClick={() => onEmail(request.guest_email)}>Email</button><button style={styles.smallButton} onClick={() => onPhone(request.guest_phone)}>Appel</button><button style={styles.smallButton} onClick={() => onSms(request.guest_phone)}>SMS</button><button style={styles.smallButton} onClick={() => onArrivalTime(request)}>Heure arrivée</button></div><div style={styles.detailGrid}><Info label="Téléphone" value={request.guest_phone} /><Info label="Arrivée" value={formatDate(request.start_date)} /><Info label="Départ" value={formatDate(request.end_date)} /><Info label="Nuits" value={request.nights} /><Info label="Prix estimatif" value={request.estimated_total ? `${request.estimated_total} €` : "-"} /><Info label="Prix proposé" value={request.owner_price ? `${request.owner_price} €` : "-"} /><Info label="Réduction" value={request.discount_amount ? `${request.discount_amount} €` : "-"} /><Info label="Source" value={request.source || "website"} /><Info label="Paiement" value={request.payment_status || "non configuré"} /><Info label="Créée le" value={formatDateTime(request.created_at)} /><Info label="Heure d’arrivée" value={request.arrival_time || "à renseigner plus tard"} /></div>{request.message && <div style={styles.noteBox}><strong>Message client</strong><p>{request.message}</p></div>}{request.owner_message && <div style={styles.noteBox}><strong>Dernier message propriétaire</strong><p>{request.owner_message}</p></div>}<div style={styles.actions}>{status === "pending" && <><button style={styles.acceptButton} onClick={() => onAccept(request)}>Accepter avec tarif/message</button><button style={styles.refuseButton} onClick={() => onRefuse(request)}>Refuser avec message</button><button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button></>}{status === "accepted" && <><button style={styles.confirmButton} onClick={() => onConfirm(request)}>Confirmer</button><button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button></>}{status === "confirmed" && <button style={styles.cancelButton} onClick={() => onCancel(request)}>Annuler</button>}{["refused", "expired", "cancelled"].includes(status) && <p style={styles.empty}>Aucune action disponible : dossier conservé dans l’historique.</p>}</div></div>;
}
function StatCard({ label, value }) { return <div style={styles.statCard}><span style={styles.statLabel}>{label}</span><strong style={styles.statValue}>{value}</strong></div>; }
function StatusBadge({ status }) { return <span style={{ ...styles.badge, backgroundColor: STATUS_COLORS[status] || "#6b7280" }}>{STATUS_LABELS[status] || status}</span>; }
function Info({ label, value }) { return <div style={styles.infoItem}><span>{label}</span><strong>{value || "-"}</strong></div>; }
function SortableTh({ label, sortKey, sort, onSort }) { const active = sort.key === sortKey; const arrow = active ? (sort.direction === "asc" ? " ↑" : " ↓") : ""; return <th style={styles.th}><button style={styles.thButton} onClick={() => onSort(sortKey)}>{label}{arrow}</button></th>; }
function EditableTd({ value, onClick }) { return <td style={styles.td} onClick={onClick} title="Cliquer pour modifier">{value || "-"}</td>; }
function getRequestName(request) { return [request.guest_first_name, request.guest_last_name].filter(Boolean).join(" ") || "Client sans nom"; }
function formatDate(value) { if (!value) return "-"; return new Date(value).toLocaleDateString("fr-FR"); }
function formatDateTime(value) { if (!value) return "-"; return new Date(value).toLocaleString("fr-FR"); }

const styles = {
  page:{minHeight:"100vh",padding:"32px",background:"#f3f0e8",color:"#1f2933",fontFamily:"Inter, system-ui, sans-serif"}, header:{display:"flex",justifyContent:"space-between",gap:"24px",alignItems:"center",marginBottom:"28px",flexWrap:"wrap"}, headerActions:{display:"flex",gap:"10px",flexWrap:"wrap"}, kicker:{margin:0,color:"#4f6f52",textTransform:"uppercase",letterSpacing:"0.12em",fontSize:"12px",fontWeight:700}, title:{margin:"6px 0",fontSize:"clamp(28px, 4vw, 44px)"}, subtitle:{margin:0,color:"#64748b"}, refreshButton:{border:"none",borderRadius:"999px",padding:"12px 18px",background:"#2f4f35",color:"white",fontWeight:700,cursor:"pointer"}, logoutButton:{border:"none",borderRadius:"999px",padding:"12px 18px",background:"#dc2626",color:"white",fontWeight:700,cursor:"pointer"}, statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"16px",marginBottom:"22px"}, statCard:{background:"white",borderRadius:"22px",padding:"20px",boxShadow:"0 12px 30px rgba(0,0,0,0.08)"}, statLabel:{color:"#64748b",fontSize:"14px"}, statValue:{display:"block",fontSize:"30px",marginTop:"8px"}, toolbar:{display:"flex",gap:"12px",marginBottom:"18px",flexWrap:"wrap"}, searchInput:{flex:"1 1 280px",padding:"14px 16px",borderRadius:"16px",border:"1px solid #d6d3c8",fontSize:"15px"}, select:{padding:"14px 16px",borderRadius:"16px",border:"1px solid #d6d3c8",background:"white"}, tabs:{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"20px"}, tab:{border:"1px solid #d6d3c8",background:"white",borderRadius:"999px",padding:"10px 16px",cursor:"pointer"}, activeTab:{border:"1px solid #2f4f35",background:"#2f4f35",color:"white",borderRadius:"999px",padding:"10px 16px",cursor:"pointer"}, contentGrid:{display:"grid",gridTemplateColumns:"minmax(0, 1fr) minmax(320px, 0.8fr)",gap:"20px"}, panel:{background:"white",borderRadius:"28px",padding:"22px",boxShadow:"0 12px 30px rgba(0,0,0,0.08)"}, panelHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}, panelTitle:{marginTop:0,marginBottom:"18px"}, list:{display:"grid",gap:"12px"}, listItem:{textAlign:"left",border:"1px solid #e5e7eb",background:"#fff",borderRadius:"18px",padding:"16px",cursor:"pointer"}, selectedListItem:{textAlign:"left",border:"2px solid #2f4f35",background:"#f6fbf6",borderRadius:"18px",padding:"16px",cursor:"pointer"}, listItemTop:{display:"flex",justifyContent:"space-between",gap:"10px",alignItems:"center",marginBottom:"8px"}, badge:{color:"white",borderRadius:"999px",padding:"5px 10px",fontSize:"12px",fontWeight:700,whiteSpace:"nowrap"}, muted:{color:"#64748b",fontSize:"14px",margin:"4px 0"}, price:{marginTop:"8px",fontWeight:800}, detail:{display:"grid",gap:"18px"}, detailHeader:{display:"flex",justifyContent:"space-between",gap:"16px"}, detailTitle:{margin:0,fontSize:"22px"}, detailGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"12px"}, infoItem:{background:"#f8fafc",borderRadius:"16px",padding:"14px"}, noteBox:{background:"#f8fafc",borderRadius:"16px",padding:"16px",lineHeight:1.5}, actions:{display:"flex",gap:"10px",flexWrap:"wrap"}, acceptButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#16a34a",color:"white",cursor:"pointer"}, refuseButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#dc2626",color:"white",cursor:"pointer"}, confirmButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#15803d",color:"white",cursor:"pointer"}, cancelButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#6b7280",color:"white",cursor:"pointer"}, addButton:{border:"none",borderRadius:"999px",padding:"10px 14px",background:"#2f4f35",color:"white",cursor:"pointer"}, smallButton:{border:"none",borderRadius:"999px",padding:"7px 10px",background:"#e2e8f0",cursor:"pointer",whiteSpace:"nowrap"}, contactButtons:{display:"flex",gap:"8px",flexWrap:"wrap"}, tableWrapper:{overflowX:"auto",maxHeight:"70vh",border:"1px solid #e5e7eb",borderRadius:"18px"}, table:{minWidth:"1200px",width:"100%",borderCollapse:"collapse",fontSize:"14px"}, stickyHead:{position:"sticky",top:0,background:"white",zIndex:2}, th:{textAlign:"left",padding:"12px",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap",background:"white"}, thButton:{border:"none",background:"transparent",fontWeight:800,cursor:"pointer",padding:0}, td:{padding:"12px",borderBottom:"1px solid #e5e7eb",cursor:"pointer",verticalAlign:"top"}, deleteButton:{border:"none",borderRadius:"999px",background:"#dc2626",color:"white",padding:"8px 12px",cursor:"pointer"}, empty:{color:"#64748b",lineHeight:1.6}, info:{background:"white",padding:"20px",borderRadius:"18px"}, error:{background:"#fee2e2",color:"#991b1b",padding:"20px",borderRadius:"18px"}
};
