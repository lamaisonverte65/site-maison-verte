import { styles } from "./adminStyles";
import { formatDate, formatMoney, getAmounts, normalizeSource } from "../../utils/adminFormatters";

const ACTIVE_STAY_STATUSES = new Set(["deposit_paid", "paid", "fully_paid", "confirmed"]);

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function guestName(request = {}) {
  return [request.guest_first_name || request.first_name, request.guest_last_name || request.last_name]
    .filter(Boolean).join(" ") || request.display_name || "Client";
}

function peopleCount(request = {}) {
  const explicit = Number(request.guests_count ?? request.guest_count ?? request.total_guests);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Number(request.adults || 0) + Number(request.children || 0);
}

function paymentLabel(request) {
  const amounts = getAmounts(request);
  if (amounts.total > 0 && amounts.paid + 0.005 >= amounts.total) return "Soldé";
  if (amounts.paid > 0) return `Payé ${formatMoney(amounts.paid)}`;
  if (["booking", "airbnb"].includes(String(request.source || "").toLowerCase())) return "Plateforme";
  return "À encaisser";
}

function DashboardCard({ title, children }) {
  return <section style={styles.homeCard}><h3 style={styles.homeCardTitle}>{title}</h3>{children}</section>;
}

export default function AdminHomePanel({ bookingRequests = [], stats, guestReviews = [], onOpenReservation, onNavigate }) {
  const today = localDateKey();
  const active = bookingRequests.filter((request) => ACTIVE_STAY_STATUSES.has(request.status));
  const inProgress = active.filter((request) => request.start_date <= today && request.end_date > today);
  const arrivals = active.filter((request) => request.start_date === today);
  const departures = active.filter((request) => request.end_date === today);
  const upcoming = active.filter((request) => request.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const nextStay = upcoming[0] || null;
  const nextFive = upcoming.slice(0, 5);

  const depositsWaiting = bookingRequests.filter((request) => request.status === "accepted" && getAmounts(request).paid + 0.005 < getAmounts(request).deposit).length;
  const balancesDue = bookingRequests.filter((request) => {
    if (!["deposit_paid", "accepted"].includes(request.status)) return false;
    const amounts = getAmounts(request);
    if (amounts.total <= amounts.paid + 0.005) return false;
    const days = request.start_date ? Math.ceil((new Date(`${request.start_date}T12:00:00`) - new Date()) / 86400000) : null;
    return days !== null && days <= 30;
  }).length;
  const overpayments = bookingRequests.filter((request) => {
    const amounts = getAmounts(request);
    return amounts.total > 0 && amounts.paid > amounts.total + 0.005;
  }).length;
  const reviewsPending = guestReviews.filter((review) => ["pending", "pending_validation", "to_validate"].includes(review.status)).length || stats.reviewsPending || 0;

  return (
    <section style={styles.homeDashboard}>
      <div style={styles.homeGrid}>
        <DashboardCard title="Aujourd’hui">
          <div style={styles.homeStatusLine}><strong>Maison</strong><span>{inProgress.length ? `Occupée — ${guestName(inProgress[0])} jusqu’au ${formatDate(inProgress[0].end_date)}` : "Libre"}</span></div>
          <div style={styles.homeStatusLine}><strong>Arrivées</strong><span>{arrivals.length}</span></div>
          <div style={styles.homeStatusLine}><strong>Départs</strong><span>{departures.length}</span></div>
          <div style={styles.homeStatusLine}><strong>Prochain séjour</strong><span>{nextStay ? `${guestName(nextStay)} — ${formatDate(nextStay.start_date)}` : "Aucun séjour à venir"}</span></div>
        </DashboardCard>

        <DashboardCard title="À traiter">
          <button style={styles.homeActionRow} onClick={() => onNavigate("requests")}><span>Demandes en attente</span><strong>{stats.pending}</strong></button>
          <button style={styles.homeActionRow} onClick={() => onNavigate("reservations")}><span>Acomptes attendus</span><strong>{depositsWaiting}</strong></button>
          <button style={styles.homeActionRow} onClick={() => onNavigate("payments")}><span>Soldes à encaisser / échus</span><strong>{balancesDue}</strong></button>
          <button style={styles.homeActionRow} onClick={() => onNavigate("payments")}><span>Remboursements / anomalies</span><strong>{overpayments}</strong></button>
          <button style={styles.homeActionRow} onClick={() => onNavigate("reviews")}><span>Avis à valider</span><strong>{reviewsPending}</strong></button>
        </DashboardCard>
      </div>

      <DashboardCard title="Prochains séjours">
        {nextFive.length === 0 ? <p style={styles.muted}>Aucun séjour à venir.</p> : (
          <div style={styles.homeStayList}>
            {nextFive.map((request) => (
              <button key={request.id} style={styles.homeStayRow} onClick={() => onOpenReservation(request)}>
                <span><strong>{formatDate(request.start_date)}</strong><small> → {formatDate(request.end_date)}</small></span>
                <span>{guestName(request)}</span>
                <span>{peopleCount(request) || "-"} pers.</span>
                <span>{normalizeSource(request.source || "Direct")}</span>
                <span>{paymentLabel(request)}</span>
              </button>
            ))}
          </div>
        )}
      </DashboardCard>

      <div style={styles.homeFinanceGrid}>
        <button style={styles.homeFinanceCard} onClick={() => onNavigate("summary")}><span>CA confirmé</span><strong>{formatMoney(stats.caConfirmed)}</strong></button>
        <button style={styles.homeFinanceCard} onClick={() => onNavigate("payments")}><span>Encaissé</span><strong>{formatMoney(stats.totalCollected)}</strong></button>
        <button style={styles.homeFinanceCard} onClick={() => onNavigate("payments")}><span>Reste à encaisser</span><strong>{formatMoney(stats.remainingToCollect)}</strong></button>
      </div>
    </section>
  );
}
