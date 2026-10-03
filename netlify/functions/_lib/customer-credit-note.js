const cents = (value) => Math.round(Number(value || 0) * 100);
const amount = (value) => Number(value ?? 0);

export function creditNoteKind(note) {
  return String(note?.financial_snapshot?.credit_note_kind || 'partial');
}

export function validateCreditNoteDraft(note) {
  if (!note || note.status !== 'draft') return { valid: false, reason: 'draft_required' };
  const f = note.financial_snapshot || {};
  if (f.manual_required === true) return { valid: false, reason: 'manual_required' };
  const accommodation = Number(f.accommodation_refund);
  const cleaning = Number(f.cleaning_refund);
  const tax = Number(f.tourist_tax_refund);
  if (![accommodation, cleaning, tax].every((v) => Number.isFinite(v) && v >= 0)) return { valid: false, reason: 'invalid_breakdown' };
  const expectedTotal = Number(note.total_amount);
  if (!Number.isFinite(expectedTotal) || expectedTotal <= 0) return { valid: false, reason: 'invalid_total' };
  if (cents(accommodation) + cents(cleaning) + cents(tax) !== cents(expectedTotal)) return { valid: false, reason: 'total_mismatch' };
  const refund = note.refund_snapshot || {};
  if (Number.isFinite(Number(refund.refunded_amount_cents)) && cents(expectedTotal) !== Number(refund.refunded_amount_cents)) return { valid: false, reason: 'refund_mismatch' };
  if (Number.isFinite(Number(refund.tourist_tax_refund_cents)) && cents(tax) !== Number(refund.tourist_tax_refund_cents)) return { valid: false, reason: 'tax_mismatch' };
  return { valid: true, reason: null };
}

export function creditNoteLines(note) {
  const f = note?.financial_snapshot || {};
  const lines = [];
  const accommodation = amount(f.accommodation_refund);
  const cleaning = amount(f.cleaning_refund);
  const tax = amount(f.tourist_tax_refund);
  if (accommodation !== 0) lines.push({ key: 'accommodation', label: 'Hébergement remboursé', amount: accommodation });
  if (cleaning !== 0) lines.push({ key: 'cleaning', label: 'Ménage remboursé', amount: cleaning });
  if (tax !== 0) lines.push({ key: 'tourist_tax', label: 'Taxe de séjour remboursée', amount: tax });
  return lines;
}
