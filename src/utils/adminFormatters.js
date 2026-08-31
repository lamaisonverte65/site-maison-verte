export function getRequestName(request) {
  return [request?.guest_first_name, request?.guest_last_name].filter(Boolean).join(" ") || "Client sans nom";
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

export function normalizeSource(source) {
  const value = String(source || "").toLowerCase();
  if (value.includes("booking")) return "Booking";
  if (value.includes("airbnb")) return "Airbnb";
  if (value.includes("phone") || value.includes("tel") || value.includes("téléphone")) return "Téléphone";
  if (value.includes("direct") || value.includes("website") || value.includes("site")) return "Site";
  if (value.includes("google")) return "Google";
  if (value.includes("facebook")) return "Facebook";
  return source || "Non renseigné";
}

export function uniqueVisitorCount(visits) {
  return new Set((visits || []).map((visit) => visit.visitor_id || visit.id).filter(Boolean)).size;
}

export function groupCount(rows, keyGetter, limit = 6) {
  const map = new Map();
  for (const row of rows || []) {
    const key = keyGetter(row) || "Non renseigné";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function getVisitMetadata(visit) {
  if (!visit?.metadata) return {};
  if (typeof visit.metadata === "object") return visit.metadata;
  try {
    return JSON.parse(visit.metadata);
  } catch {
    return {};
  }
}

export function getVisitEventType(visit) {
  return visit?.event_type || getVisitMetadata(visit).event_type || "page_view";
}

export function isPageView(visit) {
  const type = getVisitEventType(visit);
  return !type || type === "page_view";
}

export function isInternalVisit(visit, ownVisitorId) {
  const meta = getVisitMetadata(visit);
  return Boolean(
    visit?.is_internal ||
    visit?.is_admin ||
    meta.is_internal ||
    meta.is_admin ||
    (ownVisitorId && visit?.visitor_id && String(visit.visitor_id) === String(ownVisitorId))
  );
}

export function formatDurationSeconds(value) {
  const seconds = Number(value || 0);
  if (!seconds) return "-";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function getDeviceLabel(visit) {
  const meta = getVisitMetadata(visit);
  const device = visit?.device_type || meta.device_type || "-";
  const browser = visit?.browser || meta.browser || "";
  const os = visit?.os || meta.os || "";
  return [device, browser, os].filter(Boolean).join(" · ") || "-";
}

export function getCountryLabel(visit) {
  const meta = getVisitMetadata(visit);
  return visit?.country || meta.country || meta.country_hint || "-";
}

export function getLinkLabel(visit) {
  const meta = getVisitMetadata(visit);
  const text = visit?.link_text || meta.link_text || meta.element_text || "Lien";
  const href = visit?.href || meta.href || "";
  return href ? `${text} → ${href}` : text;
}

export function getVisitPageLabel(visit) {
  const meta = getVisitMetadata(visit);
  return visit?.page || meta.page || "/";
}

export function getSessionId(visit) {
  return visit?.session_id || getVisitMetadata(visit).session_id || visit?.visitor_id || "-";
}

export function average(values) {
  const filtered = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function getUniqueSessionCount(rows) {
  return new Set((rows || []).map(getSessionId).filter(Boolean)).size;
}

export function formatDayShort(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function groupVisitsByDay(rows, days = 14) {
  const map = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    map.set(key, { label: formatDayShort(date), pages: 0, clicks: 0, sessions: new Set(), visitors: new Set() });
  }

  for (const visit of rows || []) {
    const date = new Date(visit.created_at);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))) continue;
    const key = date.toISOString().slice(0, 10);
    const row = map.get(key);
    if (!row) continue;
    const type = getVisitEventType(visit);
    if (isPageView(visit)) row.pages += 1;
    if (type === "link_click") row.clicks += 1;
    if (getSessionId(visit)) row.sessions.add(getSessionId(visit));
    if (visit.visitor_id) row.visitors.add(visit.visitor_id);
  }

  return [...map.values()].map((row) => ({
    label: row.label,
    pages: row.pages,
    clicks: row.clicks,
    sessions: row.sessions.size,
    visitors: row.visitors.size,
  }));
}

export function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function shortId(id) {
  return id ? String(id).slice(0, 8).toUpperCase() : "-";
}

export function getAmounts(request) {
  const total = Number(request?.owner_price || request?.estimated_total || 0);
  const deposit = Number(request?.deposit_amount || Math.round(total * 0.3) || 0);
  const balance = Number(request?.balance_amount || Math.max(total - deposit, 0));
  const storedPaid = request?.amount_paid ?? request?.total_paid;
  const hasStoredPaid = storedPaid !== null && storedPaid !== undefined && storedPaid !== "";
  const amountPaid = Number(hasStoredPaid ? storedPaid : 0);

  let derivedPaid = amountPaid;
  if (!hasStoredPaid && ["deposit_paid", "paid"].includes(request?.status)) derivedPaid = deposit;
  if (!hasStoredPaid && ["fully_paid", "confirmed"].includes(request?.status)) derivedPaid = total;

  return { total, deposit, balance, paid: derivedPaid };
}

export function getDepositStatus(request) {
  if (request?.deposit_status) return request.deposit_status;
  if (["refused", "expired"].includes(request?.status)) return "annulé";
  if (request?.status === "cancelled") return "annulé / à vérifier";
  if (["deposit_paid", "paid", "fully_paid", "confirmed"].includes(request?.status)) return "payé";
  if (request?.status === "accepted") return "à payer";
  return "en attente";
}

export function getBalanceStatus(request) {
  if (request?.balance_status) return request.balance_status;
  if (["fully_paid", "confirmed"].includes(request?.status)) return "payé";
  if (request?.status === "cancelled") return "annulé / à vérifier";
  if (request?.status === "deposit_paid" || request?.status === "paid") return "en attente J-30";
  return "non demandé";
}

export function isCancelledFinancialStatus(status) {
  return ["refused", "expired", "cancelled"].includes(status || "");
}

export function isConfirmedFinancialStatus(status) {
  return ["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status || "");
}

export function getRealPaidAmount(request) {
  if (isCancelledFinancialStatus(request?.status)) return 0;
  return Math.max(Number(request?.amount_paid || 0), 0);
}

export function getHistoricalGrossPaidAmount(request) {
  return Math.max(Number(request?.amount_paid || 0) + Number(request?.refunded_amount || 0), 0);
}

export function getStripeBankExpectedNet(stripeNetAmount) {
  return Number(stripeNetAmount || 0);
}

export function getStripeFeeAmount(request) {
  // Les frais Stripe sont des mouvements bancaires réels :
  // ils doivent être comptabilisés même si la réservation est annulée ou remboursée.
  return Number(request?.stripe_fee_amount || 0);
}

export function getStripeNetAmount(request) {
  // Net Stripe cumulé signé, remboursements inclus, issu du ledger rapproché.
  return Number(request?.stripe_net_amount || 0);
}

export function getRefundedAmount(request) {
  return Number(request?.refunded_amount || 0);
}

export function getConfirmedStayAmount(request) {
  if (!isConfirmedFinancialStatus(request?.status)) return 0;
  return Number(request?.gross_amount || request?.owner_price || request?.estimated_total || 0);
}
