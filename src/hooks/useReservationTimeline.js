import { useMemo } from "react";
import { formatMoney } from "../utils/adminFormatters.js";

function pushTimelineItem(items, date, type, title, description = "", data = {}) {
  if (!date) return;
  items.push({
    id: `${type}-${date}-${items.length}`,
    date,
    type,
    title,
    description,
    data,
  });
}

export function buildReservationTimeline({ reservation, payments = [], events = [], emailLogs = [] }) {
    if (!reservation) return [];

    const items = [];

    pushTimelineItem(
      items,
      reservation.created_at,
      "reservation",
      "Demande créée",
      "La demande de réservation a été enregistrée."
    );

    pushTimelineItem(
      items,
      reservation.accepted_at,
      "reservation",
      "Demande acceptée",
      "La demande a été acceptée."
    );

    pushTimelineItem(
      items,
      reservation.refused_at,
      "reservation",
      "Demande refusée",
      "La demande a été refusée."
    );

    pushTimelineItem(
      items,
      reservation.confirmed_at,
      "reservation",
      "Réservation confirmée",
      "La réservation est confirmée."
    );

    pushTimelineItem(
      items,
      reservation.deposit_paid_at,
      "payment",
      "Acompte payé",
      reservation.deposit_amount ? formatMoney(reservation.deposit_amount) : "Acompte enregistré."
    );

    pushTimelineItem(
      items,
      reservation.balance_paid_at,
      "payment",
      "Solde payé",
      reservation.balance_amount ? formatMoney(reservation.balance_amount) : "Solde enregistré."
    );

    pushTimelineItem(
      items,
      reservation.transfer_date || reservation.stripe_payout_arrival_date,
      "stripe",
      "Virement / payout Stripe",
      reservation.stripe_payout_status || "Payout enregistré."
    );

    pushTimelineItem(
      items,
      reservation.review_requested_at,
      "email",
      "Demande d'avis envoyée",
      "Une demande d'avis a été envoyée au client."
    );

    for (const payment of payments || []) {
      pushTimelineItem(
        items,
        payment.paid_at || payment.created_at,
        "payment",
        payment.payment_type ? `Paiement ${payment.payment_type}` : "Paiement",
        `${payment.status || "-"} · ${formatMoney(payment.amount || 0)}`,
        payment
      );
    }

    for (const event of events || []) {
      pushTimelineItem(
        items,
        event.created_at,
        "event",
        event.label || event.event_type || "Action",
        event.message || "",
        event
      );
    }

    for (const email of emailLogs || []) {
      pushTimelineItem(
        items,
        email.sent_at || email.created_at,
        "email",
        email.email_type ? `Email ${email.email_type}` : "Email envoyé",
        `${email.subject || "Sans objet"} · ${email.to_email || "-"} · ${email.status || "-"}`,
        email
      );
    }

    return items.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

export function useReservationTimeline({ reservation, payments = [], events = [], emailLogs = [] }) {
  return useMemo(
    () => buildReservationTimeline({ reservation, payments, events, emailLogs }),
    [reservation, payments, events, emailLogs],
  );
}
