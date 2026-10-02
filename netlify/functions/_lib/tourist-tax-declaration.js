import { calculateTouristTaxNight } from "./tourist-tax.js";

const CLASSIFICATIONS = new Set(["unclassified", "1_star", "2_star", "3_star"]);

function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function dateInRange(date, from, to) {
  return Boolean(from && from <= date && (!to || to >= date));
}

function resolveOne(rows, predicate, missingMessage, duplicateMessage) {
  const matches = (rows || []).filter(predicate);
  if (matches.length === 0) throw new Error(missingMessage);
  if (matches.length > 1) throw new Error(duplicateMessage);
  return matches[0];
}

export function resolveRegulatoryClassification(date, history) {
  const row = resolveOne(
    history,
    (item) => dateInRange(date, item.effective_from, item.effective_to),
    `Classement réglementaire LMV manquant au ${date}.`,
    `Plusieurs classements LMV applicables au ${date}.`,
  );
  if (!CLASSIFICATIONS.has(row.classification)) throw new Error(`Classement LMV invalide au ${date}.`);
  return row;
}

export function resolveRegulatoryRule(date, classification, rules) {
  return resolveOne(
    rules,
    (item) => item.is_active !== false
      && item.classification === classification
      && dateInRange(date, item.effective_from, item.effective_to),
    `Barème ${classification} manquant au ${date}.`,
    `Plusieurs barèmes ${classification} applicables au ${date}.`,
  );
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

export function buildTouristTaxDeclarationRows({ bookings, classificationHistory, rules }) {
  const rows = [];
  for (const booking of bookings || []) {
    const snapshot = booking.tourist_tax_snapshot;
    const snapshotNights = Array.isArray(snapshot?.nights) ? snapshot.nights : [];
    if (!snapshotNights.length) continue;

    const commercialWeights = snapshotNights.map((night) => Math.max(0, Number(night.totalTaxCents) || 0));
    const collectedByNight = allocateCents(cents(booking.tourist_tax_collected), commercialWeights);
    const refundedByNight = allocateCents(cents(booking.tourist_tax_refunded), commercialWeights);

    snapshotNights.forEach((night, index) => {
      const date = String(night.date || "");
      const commercialTaxCents = Math.max(0, Math.round(Number(night.totalTaxCents) || 0));
      const collectedCents = collectedByNight[index] || 0;
      const refundedCents = Math.min(collectedCents, refundedByNight[index] || 0);
      const row = {
        bookingId: booking.id,
        guestName: [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(" ").trim() || "—",
        startDate: booking.start_date,
        endDate: booking.end_date,
        nightDate: date,
        collector: booking.tourist_tax_collector,
        occupants: Number(snapshot.occupants ?? night.occupants ?? 0),
        taxablePeople: Number(snapshot.taxablePeople ?? night.taxablePeople ?? 0),
        exemptPeople: Number(snapshot.exemptPeople ?? 0),
        accommodationCents: Math.max(0, Math.round(Number(night.accommodationCents) || 0)),
        commercialClassification: snapshot.classification || night.rule?.classification || null,
        commercialRuleId: night.rule?.id || null,
        commercialTaxCents,
        collectedCents,
        refundedCents,
        netCollectedCents: collectedCents - refundedCents,
        regulatoryClassification: null,
        regulatoryRuleId: null,
        regulatoryTaxCents: null,
        regulatoryDeltaCents: null,
        status: "ok",
        issue: null,
      };

      try {
        const classification = resolveRegulatoryClassification(date, classificationHistory);
        const rule = resolveRegulatoryRule(date, classification.classification, rules);
        const regulatory = calculateTouristTaxNight({
          accommodationCents: row.accommodationCents,
          occupants: row.occupants,
          taxablePeople: row.taxablePeople,
          rule,
        });
        row.regulatoryClassification = classification.classification;
        row.regulatoryRuleId = rule.id;
        row.regulatoryTaxCents = regulatory.totalTaxCents;
        row.regulatoryDeltaCents = regulatory.totalTaxCents - commercialTaxCents;
      } catch (error) {
        row.status = "missing_regulatory_data";
        row.issue = error.message;
      }
      rows.push(row);
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
  const knownRegulatory = directRows.filter((row) => row.regulatoryTaxCents !== null);
  return {
    year: Number(year),
    month: Number(month),
    directRows,
    platformRows,
    totals: {
      nights: directRows.length,
      commercialTaxCents: sum(directRows, "commercialTaxCents"),
      collectedCents: sum(directRows, "collectedCents"),
      refundedCents: sum(directRows, "refundedCents"),
      netCollectedCents: sum(directRows, "netCollectedCents"),
      regulatoryTaxCents: sum(knownRegulatory, "regulatoryTaxCents"),
      regulatoryDeltaCents: sum(knownRegulatory, "regulatoryDeltaCents"),
      missingRegulatoryNights: directRows.length - knownRegulatory.length,
      platformNights: platformRows.length,
    },
  };
}
