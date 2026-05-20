import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function requireAdmin(event) {
  const rawHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  const token = rawHeader.startsWith("Bearer ")
    ? rawHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      },
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      error: {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid admin session" }),
      },
    };
  }

  const allowedRaw =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    "";

  const allowedEmails = allowedRaw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedEmails.length > 0 &&
    !allowedEmails.includes(String(data.user.email || "").toLowerCase())
  ) {
    return {
      error: {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      },
    };
  }

  return { user: data.user };
}



function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

async function logBookingEvent({ bookingId, eventType, label, message, actor = "admin", metadata = {} }) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: eventType,
    label,
    message,
    actor,
    metadata,
  }]);
  if (error) console.error("Erreur log booking_events:", error.message);
}

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null, metadata = {} }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId || null,
    email_type: emailType,
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    sent_at: new Date().toISOString(),
    metadata,
  }]);
  if (error) console.error("Erreur log email_logs:", error.message);
}

function getRefundable(payment) {
  return Math.max(Number(payment.amount || 0) - Number(payment.refunded_amount || 0), 0);
}

function computePolicyRefund({ booking, payments, cancellationType }) {
  const paid = payments.reduce((sum, payment) => sum + getRefundable(payment), 0);

  if (paid <= 0) return { amount: 0, label: "Aucun montant remboursable" };

  if (cancellationType === "owner") {
    return { amount: paid, label: "Annulation propriétaire : remboursement total" };
  }

  const days = daysUntil(booking.start_date);

  if (days === null) {
    return { amount: 0, label: "Date d’arrivée inconnue : remboursement manuel requis" };
  }

  if (days > 30) {
    return { amount: paid, label: "Annulation client à plus de 30 jours : remboursement total" };
  }

  if (days > 7) {
    const refundableBalance = payments
      .filter((payment) => {
        const type = payment.payment_type;
        const reason = payment.manual_reason;
        return type === "balance" || type === "full" || reason === "solde" || reason === "total" || reason === "complement";
      })
      .reduce((sum, payment) => sum + getRefundable(payment), 0);

    return {
      amount: Math.min(refundableBalance, paid),
      label: "Annulation client entre J-30 et J-7 : acompte conservé, solde remboursable",
    };
  }

  return { amount: 0, label: "Annulation client à moins de 7 jours : aucun remboursement" };
}

function computeRequestedRefund({ booking, payments, refundMode, cancellationType, customAmount }) {
  const paid = payments.reduce((sum, payment) => sum + getRefundable(payment), 0);

  if (paid <= 0) return { amount: 0, label: "Aucun paiement remboursable" };

  if (refundMode === "none") return { amount: 0, label: "Aucun remboursement choisi" };

  if (refundMode === "policy") {
    return computePolicyRefund({ booking, payments, cancellationType });
  }

  if (refundMode === "total") return { amount: paid, label: "Remboursement total choisi" };

  if (refundMode === "custom") {
    return {
      amount: Math.min(Number(customAmount || 0), paid),
      label: "Remboursement montant libre",
    };
  }

  if (refundMode === "deposit") {
    const depositAmount = Number(booking.deposit_amount || Math.round(Number(booking.owner_price || booking.estimated_total || 0) * 0.3));
    const depositPaid = payments
      .filter((payment) => payment.payment_type === "deposit" || payment.manual_reason === "acompte")
      .reduce((sum, payment) => sum + getRefundable(payment), 0);

    return {
      amount: Math.min(depositPaid || depositAmount, paid),
      label: "Remboursement acompte choisi",
    };
  }

  if (refundMode === "balance") {
    const balancePaid = payments
      .filter((payment) => payment.payment_type === "balance" || payment.manual_reason === "solde" || payment.manual_reason === "complement" || payment.manual_reason === "total")
      .reduce((sum, payment) => sum + getRefundable(payment), 0);

    return {
      amount: Math.min(balancePaid, paid),
      label: "Remboursement solde choisi",
    };
  }

  return { amount: 0, label: "Mode de remboursement inconnu" };
}

async function sendCancellationEmail({ booking, cancellationType, refundedAmount, message, policyLabel }) {
  if (!booking?.guest_email) return;

  const subject = cancellationType === "owner"
    ? "Annulation de votre réservation - La Maison Verte"
    : "Confirmation d’annulation - La Maison Verte";

  const refundParagraph = refundedAmount > 0
    ? `<p>Un remboursement de <strong>${formatCurrency(refundedAmount)}</strong> a été déclenché via Stripe. Le délai d’apparition sur le compte bancaire dépend de votre banque.</p>`
    : `<p>Aucun remboursement Stripe n’a été déclenché pour cette annulation.</p>`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${subject}</h2>

      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>

      <p>
        Nous vous confirmons l’annulation de la réservation à <strong>La Maison Verte à Arreau</strong>.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}
      </p>

      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}

      <p><strong>Règle appliquée :</strong><br />${policyLabel}</p>

      ${refundParagraph}

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages,
        puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erreur email annulation/remboursement :", errorText);
    await logEmail({
      bookingId: booking.id,
      emailType: "booking_cancelled_refund",
      toEmail: booking.guest_email,
      subject,
      status: "error",
      errorMessage: errorText,
      metadata: { cancellationType, refundedAmount, policyLabel },
    });
    return;
  }

  let responseData = null;
  try {
    responseData = await response.json();
  } catch (_) {}

  await logEmail({
    bookingId: booking.id,
    emailType: "booking_cancelled_refund",
    toEmail: booking.guest_email,
    subject,
    status: "sent",
    providerId: responseData?.id || null,
    metadata: { cancellationType, refundedAmount, policyLabel },
  });
}

async function sendRefundOnlyEmail({ booking, refundedAmount, message, policyLabel }) {
  if (!booking?.guest_email) return;

  const subject = "Remboursement effectué - La Maison Verte";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Remboursement effectué</h2>

      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>

      <p>
        Nous vous confirmons qu’un remboursement de <strong>${formatCurrency(refundedAmount)}</strong>
        a été déclenché via Stripe concernant votre séjour à <strong>La Maison Verte à Arreau</strong>.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}
      </p>

      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}

      <p><strong>Motif :</strong><br />${policyLabel}</p>

      <p>
        Ce remboursement ne modifie pas automatiquement votre réservation. Le délai d’apparition sur votre compte bancaire dépend de votre banque.
      </p>

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages,
        puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erreur email remboursement simple :", errorText);
    await logEmail({
      bookingId: booking.id,
      emailType: "refund_only",
      toEmail: booking.guest_email,
      subject,
      status: "error",
      errorMessage: errorText,
      metadata: { refundedAmount, policyLabel },
    });
    return;
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}

  await logEmail({
    bookingId: booking.id,
    emailType: "refund_only",
    toEmail: booking.guest_email,
    subject,
    status: "sent",
    providerId: responseData?.id || null,
    metadata: { refundedAmount, policyLabel },
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const adminAuth = await requireAdmin(event);
  if (adminAuth.error) return adminAuth.error;

  try {
    const data = JSON.parse(event.body || "{}");
    const {
      bookingId,
      action = "cancel_refund",
      refundOnly = false,
      cancellationType = "client",
      refundMode = "policy",
      refundAmount,
      message = "",
    } = data;

    if (!bookingId) {
      return { statusCode: 400, body: JSON.stringify({ error: "bookingId obligatoire." }) };
    }

    const isRefundOnly = action === "refund_only" || refundOnly === true;

    const { data: booking, error: bookingError } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return { statusCode: 404, body: JSON.stringify({ error: bookingError?.message || "Réservation introuvable." }) };
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_request_id", bookingId)
      .eq("status", "paid")
      .order("created_at", { ascending: true });

    if (paymentsError) {
      return { statusCode: 500, body: JSON.stringify({ error: paymentsError.message }) };
    }

    const refundablePayments = (payments || []).filter((payment) => getRefundable(payment) > 0 && payment.stripe_payment_intent_id);
    const requested = computeRequestedRefund({
      booking,
      payments: refundablePayments,
      refundMode,
      cancellationType,
      customAmount: refundAmount,
    });

    let remainingToRefund = Number(requested.amount || 0);
    const refundResults = [];

    for (const payment of refundablePayments) {
      if (remainingToRefund <= 0) break;

      const refundable = getRefundable(payment);
      const amountForThisPayment = Math.min(refundable, remainingToRefund);
      if (amountForThisPayment <= 0) continue;

      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: Math.round(amountForThisPayment * 100),
        metadata: {
          booking_id: bookingId,
          payment_id: payment.id,
          cancellation_type: cancellationType,
          refund_mode: refundMode,
          action: isRefundOnly ? "refund_only" : "cancel_refund",
        },
      });

      refundResults.push({ payment, refund, amount: amountForThisPayment });
      remainingToRefund -= amountForThisPayment;

      const newRefundedAmount = Number(payment.refunded_amount || 0) + amountForThisPayment;
      const paymentStatus = newRefundedAmount >= Number(payment.amount || 0) ? "refunded" : "partially_refunded";

      await supabase.from("payments").update({
        refunded_amount: newRefundedAmount,
        refund_status: paymentStatus,
        status: paymentStatus,
        stripe_refund_id: refund.id,
        refunded_at: new Date().toISOString(),
        refund_reason: requested.label,
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);

      await supabase.from("refunds").insert([{
        booking_request_id: bookingId,
        payment_id: payment.id,
        amount: amountForThisPayment,
        currency: payment.currency || "eur",
        status: refund.status || "succeeded",
        cancellation_type: cancellationType,
        refund_mode: refundMode,
        reason: requested.label,
        stripe_refund_id: refund.id,
        stripe_payment_intent_id: payment.stripe_payment_intent_id,
        metadata: refund,
      }]);
    }

    const refundedAmount = refundResults.reduce((sum, item) => sum + item.amount, 0);
    const previousRefunded = Number(booking.refunded_amount || 0);
    const totalRefunded = previousRefunded + refundedAmount;
    const now = new Date().toISOString();
    const lastRefundId = refundResults[refundResults.length - 1]?.refund?.id || booking.stripe_refund_id || null;

    const paidAmount = Number(booking.amount_paid || 0);
    const remainingPaid = Math.max(paidAmount - refundedAmount, 0);

    if (isRefundOnly) {
      const { error: updateError } = await supabase.from("booking_requests").update({
        payment_status: refundedAmount > 0
          ? (remainingPaid > 0 ? "partially_refunded" : "refunded")
          : booking.payment_status,
        owner_message: message || booking.owner_message,
        refund_policy_applied: requested.label,
        refund_reason: message || requested.label,
        refunded_amount: totalRefunded,
        stripe_refund_id: lastRefundId,
        amount_paid: remainingPaid,
        updated_at: now,
      }).eq("id", bookingId);

      if (updateError) {
        return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };
      }

      await logBookingEvent({
        bookingId,
        eventType: "refund_only",
        label: refundedAmount > 0 ? "Remboursement simple effectué" : "Remboursement simple sans montant remboursé",
        message: `${requested.label}. Montant remboursé : ${formatCurrency(refundedAmount)}. ${message}`,
        metadata: {
          refundMode,
          requestedAmount: requested.amount,
          refundedAmount,
          stripeRefundIds: refundResults.map((item) => item.refund.id),
          reservationStatusKept: booking.status,
        },
      });

      if (refundedAmount > 0) {
        await sendRefundOnlyEmail({
          booking,
          refundedAmount,
          message,
          policyLabel: requested.label,
        });
      }
    } else {
      const depositStatus =
        refundedAmount > 0 && refundMode === "deposit" ? "remboursé" :
        refundedAmount > 0 && ["total", "policy"].includes(refundMode) && cancellationType === "owner" ? "remboursé" :
        booking.deposit_status || "annulé";

      const balanceStatus =
        refundedAmount > 0 && ["balance", "total", "policy", "custom"].includes(refundMode) ? "remboursé / à vérifier" :
        booking.balance_status || "annulé";

      const { error: updateError } = await supabase.from("booking_requests").update({
        status: "cancelled",
        payment_status: refundedAmount > 0 ? "refunded_or_cancelled" : booking.payment_status || "cancelled",
        owner_message: message,
        cancelled_at: now,
        cancelled_by: cancellationType,
        refund_policy_applied: requested.label,
        refund_reason: message || requested.label,
        refunded_amount: totalRefunded,
        stripe_refund_id: lastRefundId,
        amount_paid: remainingPaid,
        deposit_status: depositStatus,
        balance_status: balanceStatus,
        manual_payment_status: booking.manual_payment_status === "paid" && refundedAmount > 0 ? "remboursé / à vérifier" : booking.manual_payment_status,
        updated_at: now,
      }).eq("id", bookingId);

      if (updateError) {
        return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };
      }

      await logBookingEvent({
        bookingId,
        eventType: "booking_cancelled_refund",
        label: refundedAmount > 0 ? "Réservation annulée et remboursement effectué" : "Réservation annulée sans remboursement",
        message: `${requested.label}. Montant remboursé : ${formatCurrency(refundedAmount)}. ${message}`,
        metadata: {
          cancellationType,
          refundMode,
          requestedAmount: requested.amount,
          refundedAmount,
          stripeRefundIds: refundResults.map((item) => item.refund.id),
        },
      });

      await sendCancellationEmail({
        booking,
        cancellationType,
        refundedAmount,
        message,
        policyLabel: requested.label,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        refundedAmount,
        refundCount: refundResults.length,
        policy: requested.label,
        action: isRefundOnly ? "refund_only" : "cancel_refund",
      }),
    };
  } catch (error) {
    console.error("Erreur refund-booking-payment :", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
