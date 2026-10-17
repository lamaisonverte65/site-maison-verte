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

export function buildTouristTaxDeclarationRows({ bookings }) {
  const rows = [];
  for (const booking of bookings || []) {
    const snapshot = booking.tourist_tax_snapshot;
    const snapshotNights = Array.isArray(snapshot?.nights) ? snapshot.nights : [];
    if (!snapshotNights.length) continue;

    const snapshotWeights = snapshotNights.map((night) => snapshotCents(night.totalTaxCents) ?? 0);
    const collectedByNight = allocateCents(cents(booking.tourist_tax_collected), snapshotWeights);
    const refundedByNight = allocateCents(cents(booking.tourist_tax_refunded), snapshotWeights);

    snapshotNights.forEach((night, index) => {
      const snapshotTaxCents = snapshotCents(night.totalTaxCents);
      const collectedCents = collectedByNight[index] || 0;
      const refundedCents = Math.min(collectedCents, refundedByNight[index] || 0);
      const missingSnapshot = snapshotTaxCents === null || !night.date;
      rows.push({
        bookingId: booking.id,
        guestName: [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(" ").trim() || "—",
        startDate: booking.start_date,
        endDate: booking.end_date,
        nightDate: String(night.date || ""),
        collector: booking.tourist_tax_collector,
        occupants: Number(snapshot.occupants ?? night.occupants ?? 0),
        taxablePeople: Number(snapshot.taxablePeople ?? night.taxablePeople ?? 0),
        exemptPeople: Number(snapshot.exemptPeople ?? 0),
        accommodationCents: Math.max(0, Math.round(Number(night.accommodationCents) || 0)),
        snapshotClassification: snapshot.classification || night.rule?.classification || null,
        snapshotRuleId: night.rule?.id || null,
        snapshotTaxCents,
        // Aliases kept for consumers that still render the former commercial snapshot names.
        commercialClassification: snapshot.classification || night.rule?.classification || null,
        commercialRuleId: night.rule?.id || null,
        commercialTaxCents: snapshotTaxCents,
        collectedCents,
        refundedCents,
        netCollectedCents: collectedCents - refundedCents,
        status: missingSnapshot ? "missing_snapshot_data" : "ok",
        issue: missingSnapshot ? "Snapshot historique de taxe de séjour incomplet pour cette nuit." : null,
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
  return {
    year: Number(year),
    month: Number(month),
    directRows,
    platformRows,
    totals: {
      nights: directRows.length,
      snapshotTaxCents: sum(knownSnapshot, "snapshotTaxCents"),
      commercialTaxCents: sum(knownSnapshot, "snapshotTaxCents"),
      collectedCents: sum(directRows, "collectedCents"),
      refundedCents: sum(directRows, "refundedCents"),
      netCollectedCents: sum(directRows, "netCollectedCents"),
      missingSnapshotNights: directRows.length - knownSnapshot.length,
      platformNights: platformRows.length,
    },
  };
}
