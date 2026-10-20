import { calculateTouristTaxNight } from "./tourist-tax.js";

function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function snapshotCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function allocateCents(totalCents, weights) {
  const total = Math.max(0, Math.round(Number(totalCents) || 0));
  const normalized = weights.map((value) => Math.max(0, Math.round(Number(value) || 0)));
  const weightTotal = normalized.reduce((sum, value) => sum + value, 0);
  if (!normalized.length) return [];
  if (total === 0) return normalized.map(() => 0);
  if (weightTotal === 0) {
    const base = Math.floor(total / normalized.length);
    const remainder = total - base * normalized.length;
    return normalized.map((_, index) => base + (index < remainder ? 1 : 0));
  }
  const raw = normalized.map((value) => total * value / weightTotal);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) floors[order[index].index] += 1;
  return floors;
}

function findUniquePeriod(items, date) {
  const applicable = (items || []).filter((item) => item?.effective_from <= date && (!item.effective_to || item.effective_to >= date));
  return applicable.length === 1 ? applicable[0] : null;
}

// The contractual snapshot is immutable. This *separate* amount is a proposal
// for the Aure-Louron declaration, never a write to the booking or its payments.
function regulatoryNight({ night, snapshot, classificationHistory, rules }) {
  const classification = findUniquePeriod(classificationHistory, String(night.date || ""));
  if (!classification) return { dueCents: null, dueClassification: null, dueRuleId: null, reason: "Classement applicable introuvable ou ambigu." };
  const rule = findUniquePeriod((rules || []).filter((item) => item.is_active !== false && item.classification === classification.classification), String(night.date || ""));
  if (!rule) return { dueCents: null, dueClassification: classification.classification, dueRuleId: null, reason: "Barème applicable introuvable ou ambigu." };
  const occupants = Number(snapshot.occupants ?? night.occupants);
  const taxablePeople = Number(snapshot.taxablePeople ?? night.taxablePeople);
  if (!Number.isInteger(occupants) || occupants < 1 || !Number.isInteger(taxablePeople) || taxablePeople < 0 || taxablePeople > occupants) {
    return { dueCents: null, dueClassification: classification.classification, dueRuleId: rule.id, reason: "Occupants ou personnes taxables non renseignés." };
  }
  const nightlyPrice = Number(night.accommodationCents);
  if (!Number.isSafeInteger(nightlyPrice) || nightlyPrice < 0) {
    return { dueCents: null, dueClassification: classification.classification, dueRuleId: rule.id, reason: "Prix de nuitée historique manquant." };
  }
  try {
    const result = calculateTouristTaxNight({ accommodationCents: nightlyPrice, occupants, taxablePeople, rule });
    return { dueCents: result.totalTaxCents, dueClassification: classification.classification, dueRuleId: rule.id, reason: null };
  } catch {
    return { dueCents: null, dueClassification: classification.classification, dueRuleId: rule.id, reason: "Paramètres du barème incohérents." };
  }
}

export function buildTouristTaxDeclarationRows({ bookings, classificationHistory = null, rules = null, todayDate = null }) {
  const rows = [];
  const regulatoryAvailable = Array.isArray(classificationHistory) && Array.isArray(rules);
  for (const booking of bookings || []) {
    const snapshot = booking.tourist_tax_snapshot;
    const snapshotNights = Array.isArray(snapshot?.nights) ? snapshot.nights : [];
    if (!snapshotNights.length) continue;

    const snapshotWeights = snapshotNights.map((night) => snapshotCents(night.totalTaxCents) ?? 0);
    const collectedByNight = allocateCents(cents(booking.tourist_tax_collected), snapshotWeights);
    const refundedByNight = allocateCents(cents(booking.tourist_tax_refunded), snapshotWeights);
    const cancelled = ["cancelled", "canceled", "no_show", "no-show"].includes(String(booking.status || "").toLowerCase());

    snapshotNights.forEach((night, index) => {
      const date = String(night.date || "");
      const snapshotTaxCents = snapshotCents(night.totalTaxCents);
      const collectedCents = collectedByNight[index] || 0;
      const refundedCents = Math.min(collectedCents, refundedByNight[index] || 0);
      const missingSnapshot = snapshotTaxCents === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || date < String(booking.start_date) || date >= String(booking.end_date);
      const upcoming = !!todayDate && date >= todayDate;
      let legal = { dueCents: null, dueClassification: null, dueRuleId: null, reason: null };
      let dueStatus = "not_calculated";
      if (cancelled) {
        legal = { dueCents: 0, dueClassification: null, dueRuleId: null, reason: "Séjour annulé ou non réalisé : aucune taxe due." };
        dueStatus = "cancelled";
      } else if (upcoming) {
        dueStatus = "upcoming";
      } else if (regulatoryAvailable && !missingSnapshot) {
        legal = regulatoryNight({ night, snapshot, classificationHistory, rules });
        dueStatus = legal.dueCents === null ? "to_review" : "presumed_performed";
      } else if (regulatoryAvailable) {
        dueStatus = "to_review";
      }
      rows.push({
        bookingId: booking.id,
        guestName: [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(" ").trim() || "—",
        startDate: booking.start_date,
        endDate: booking.end_date,
        nightDate: date,
        bookingStatus: booking.status || null,
        collector: booking.tourist_tax_collector,
        occupants: Number(snapshot.occupants ?? night.occupants ?? 0),
        taxablePeople: Number(snapshot.taxablePeople ?? night.taxablePeople ?? 0),
        exemptPeople: Number(snapshot.exemptPeople ?? 0),
        accommodationCents: Math.max(0, Math.round(Number(night.accommodationCents) || 0)),
        snapshotClassification: snapshot.classification || night.rule?.classification || null,
        snapshotRuleId: night.rule?.id || null,
        snapshotTaxCents,
        commercialClassification: snapshot.classification || night.rule?.classification || null,
        commercialRuleId: night.rule?.id || null,
        commercialTaxCents: snapshotTaxCents,
        collectedCents,
        refundedCents,
        netCollectedCents: collectedCents - refundedCents,
        dueTaxCents: legal.dueCents,
        dueClassification: legal.dueClassification,
        dueRuleId: legal.dueRuleId,
        dueStatus,
        dueDifferenceCents: legal.dueCents !== null && snapshotTaxCents !== null ? legal.dueCents - snapshotTaxCents : null,
        status: missingSnapshot ? "missing_snapshot_data" : "ok",
        issue: missingSnapshot ? "Snapshot historique de taxe de séjour incomplet pour cette nuit." : legal.reason,
      });
    });
  }
  return rows;
}

export function summarizeTouristTaxDeclaration(rows, { year, month }) {
  const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-`;
  const periodRows = (rows || []).filter((row) => String(row.nightDate || "").startsWith(prefix));
  const directRows = periodRows.filter((row) => row.collector === "la_maison_verte");
  const platformRows = periodRows.filter((row) => row.collector === "platform");
  const sum = (list, key) => list.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const knownSnapshot = directRows.filter((row) => row.snapshotTaxCents !== null);
  const dueRows = directRows.filter((row) => row.dueStatus === "presumed_performed");
  const exemptCancelled = directRows.filter((row) => row.dueStatus === "cancelled");
  const reviewedRows = directRows.filter((row) => row.dueStatus === "to_review");
  const provisionalDue = sum(dueRows, "dueTaxCents");
  const amountBilledForDue = sum(dueRows, "snapshotTaxCents");
  return {
    year: Number(year), month: Number(month), directRows, platformRows,
    totals: {
      nights: directRows.length,
      snapshotTaxCents: sum(knownSnapshot, "snapshotTaxCents"),
      commercialTaxCents: sum(knownSnapshot, "snapshotTaxCents"),
      collectedCents: sum(directRows, "collectedCents"),
      refundedCents: sum(directRows, "refundedCents"),
      netCollectedCents: sum(directRows, "netCollectedCents"),
      missingSnapshotNights: directRows.length - knownSnapshot.length,
      platformNights: platformRows.length,
      presumedPerformedNights: dueRows.length,
      cancelledNights: exemptCancelled.length,
      cancelledTaxStillCollectedCents: sum(exemptCancelled, "netCollectedCents"),
      upcomingNights: directRows.filter((row) => row.dueStatus === "upcoming").length,
      needsReviewNights: reviewedRows.length,
      dueTaxCents: provisionalDue,
      billedForDueCents: amountBilledForDue,
      differenceDueBilledCents: provisionalDue - amountBilledForDue,
    },
  };
}
