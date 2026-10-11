import { SELLER_SNAPSHOT } from "./direct-invoice-draft.js";

const clean = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};
const money = (value) => value == null || value === "" ? null : Number(value);

function nightsBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${String(startDate).slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${String(endDate).slice(0, 10)}T12:00:00Z`);
  const nights = Math.round((end - start) / 86400000);
  return Number.isFinite(nights) && nights >= 0 ? nights : null;
}

export function buildCleaningInvoiceDraft({ booking, issue, payment }) {
  if (!booking?.id) throw new Error("booking_required");
  if (!issue?.id || issue.booking_request_id !== booking.id) throw new Error("cleaning_issue_required");
  if (issue.status !== "paid" || !issue.payment_id) throw new Error("cleaning_issue_not_paid");
  if (!payment?.id || payment.id !== issue.payment_id) throw new Error("cleaning_payment_required");
  if (payment.payment_type !== "manual" || payment.manual_reason !== "cleaning") throw new Error("cleaning_payment_required");
  const amount = money(issue.amount_due);
  const paidAmount = money(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("cleaning_amount_invalid");
  if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - amount) > 0.009) throw new Error("cleaning_payment_amount_mismatch");

  return {
    source: "direct",
    booking_request_id: booking.id,
    external_reference: null,
    invoice_kind: "post_stay_cleaning",
    cleaning_issue_id: issue.id,
    status: "draft",
    seller_snapshot: { ...SELLER_SNAPSHOT },
    customer_snapshot: {
      first_name: clean(booking.guest_first_name),
      last_name: clean(booking.guest_last_name),
      email: clean(booking.guest_email),
      phone: clean(booking.guest_phone),
      address: clean(booking.guest_address),
      postal_code: clean(booking.guest_postal_code),
      city: clean(booking.guest_city),
      country: clean(booking.guest_country),
    },
    stay_snapshot: {
      start_date: booking.start_date,
      end_date: booking.end_date,
      nights: nightsBetween(booking.start_date, booking.end_date),
      adults_count: booking.adults_count == null ? null : Number(booking.adults_count),
      children_count: booking.children_count == null ? null : Number(booking.children_count),
      children_ages: Array.isArray(booking.children_ages) ? booking.children_ages : [],
      accommodation_name: SELLER_SNAPSHOT.accommodation_name,
      accommodation_address: SELLER_SNAPSHOT.accommodation_address,
      accommodation_postal_code: SELLER_SNAPSHOT.accommodation_postal_code,
      accommodation_city: SELLER_SNAPSHOT.accommodation_city,
      accommodation_country: SELLER_SNAPSHOT.accommodation_country,
    },
    financial_snapshot: {
      draft_origin: "post_stay_cleaning",
      cleaning_issue_id: issue.id,
      cleaning_issue_note: clean(issue.notes),
      accommodation_gross: 0,
      accommodation_net: 0,
      promotion_discount_amount: 0,
      cleaning_fee: amount,
      tourist_tax_amount: 0,
      post_stay_cleaning_total: amount,
    },
    payment_snapshot: [{
      id: payment.id,
      payment_type: payment.payment_type,
      manual_reason: payment.manual_reason,
      amount: paidAmount,
      currency: String(payment.currency || "eur").toLowerCase(),
      status: payment.status || "paid",
      paid_at: payment.paid_at || null,
      refunded_amount: Number(payment.refunded_amount || 0),
      refunded_at: payment.refunded_at || null,
    }],
    currency: "eur",
    total_amount: amount,
  };
}
