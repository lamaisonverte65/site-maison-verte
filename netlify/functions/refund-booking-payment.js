import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import {
  normalizeRefundRequest,
  processRefundOperation,
  RefundOperationError,
} from "./_lib/refund-operation.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
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
  if (error) throw new RefundOperationError("email_log_failed", `Journalisation email impossible : ${error.message}`, error);
}

async function sendCancellationEmail({ booking, cancellationType, refundedAmount, message, policyLabel }) {
  if (!booking?.guest_email) return;

  const subject = cancellationType === "owner"
    ? "Annulation de votre réservation - La Maison Verte"
    : "Confirmation d’annulation - La Maison Verte";
  const refundParagraph = refundedAmount > 0
    ? `<p>Un remboursement de <strong>${formatCurrency(refundedAmount)}</strong> a été déclenché via Stripe. Le délai d’apparition sur le compte bancaire dépend de votre banque.</p>`
    : "<p>Aucun remboursement Stripe n’a été déclenché pour cette annulation.</p>";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${subject}</h2>
      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>
      <p>Nous vous confirmons l’annulation de la réservation à <strong>La Maison Verte à Arreau</strong>.</p>
      <p><strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br /><strong>Départ :</strong> ${formatDate(booking.end_date)}</p>
      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}
      <p><strong>Règle appliquée :</strong><br />${policyLabel}</p>
      ${refundParagraph}
      <p style="margin-top:30px;font-size:13px;color:#666;">Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages, puis ajoutez contact@lamaisonverte65.fr à vos contacts.</p>
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
  try { responseData = await response.json(); } catch (_) {}
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
  if (!booking?.guest_email || refundedAmount <= 0) return;

  const subject = "Remboursement effectué - La Maison Verte";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Remboursement effectué</h2>
      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>
      <p>Nous vous confirmons qu’un remboursement de <strong>${formatCurrency(refundedAmount)}</strong> a été déclenché via Stripe concernant votre séjour à <strong>La Maison Verte à Arreau</strong>.</p>
      <p><strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br /><strong>Départ :</strong> ${formatDate(booking.end_date)}</p>
      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}
      <p><strong>Motif :</strong><br />${policyLabel}</p>
      <p>Ce remboursement ne modifie pas automatiquement votre réservation. Le délai d’apparition sur votre compte bancaire dépend de votre banque.</p>
      <p style="margin-top:30px;font-size:13px;color:#666;">Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages, puis ajoutez contact@lamaisonverte65.fr à vos contacts.</p>
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

async function rpc(name, parameters) {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) {
    const code = error.code === "23505" ? "refund_operation_conflict" : "refund_database_error";
    throw new RefundOperationError(code, `${name} a échoué : ${error.message}`, error);
  }
  if (!data) throw new RefundOperationError("refund_database_error", `${name} n’a retourné aucun résultat.`);
  return data;
}

function dependenciesForRefund() {
  return {
    async acquireOperation(request) {
      return rpc("acquire_stripe_refund_operation", {
        p_operation_id: request.operationId,
        p_booking_id: request.bookingId,
        p_action: request.action,
        p_is_refund_only: request.refundOnly,
        p_refund_mode: request.refundMode,
        p_cancellation_type: request.cancellationType,
        p_custom_amount_cents: request.refundAmountCents,
        p_message: request.message,
      });
    },

    async createStripeRefund(payload, options) {
      return stripe.refunds.create(payload, options);
    },

    async claimAllocation(payload) {
      return rpc("claim_stripe_refund_allocation", {
        p_operation_id: payload.operationId,
        p_allocation_id: payload.allocationId,
      });
    },

    async retrieveStripeRefund(refundId) {
      return stripe.refunds.retrieve(refundId);
    },

    async listStripeRefundsPage({ paymentIntent, limit, startingAfter }) {
      const page = await stripe.refunds.list({
        payment_intent: paymentIntent,
        limit,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      return { data: page.data, has_more: page.has_more };
    },

    async recordStripeResult(payload) {
      return rpc("record_stripe_refund_result", {
        p_operation_id: payload.operationId,
        p_allocation_id: payload.allocationId,
        p_stripe_refund_id: payload.stripeRefundId,
        p_stripe_status: payload.stripeStatus,
        p_stripe_metadata: payload.stripeMetadata,
      });
    },

    async recordStripeFailure(payload) {
      return rpc("record_stripe_refund_failure", {
        p_operation_id: payload.operationId,
        p_allocation_id: payload.allocationId,
        p_status: payload.status,
        p_stripe_refund_id: payload.stripeRefundId || null,
        p_error: payload.error,
      });
    },

    async finalizeOperation(operationId) {
      return rpc("finalize_stripe_refund_operation", { p_operation_id: operationId });
    },

    async notify({ request, result }) {
      const booking = result.booking;
      const refundedAmount = Number(result.refunded_amount_cents || 0) / 100;
      const policyLabel = result.policy_label || "Remboursement";
      if (request.refundOnly) {
        await sendRefundOnlyEmail({ booking, refundedAmount, message: request.message, policyLabel });
      } else {
        await sendCancellationEmail({
          booking,
          cancellationType: request.cancellationType,
          refundedAmount,
          message: request.message,
          policyLabel,
        });
      }
    },
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const adminAuth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePayments] });
  if (!adminAuth.ok) return authorizationResponse(adminAuth);

  try {
    const request = normalizeRefundRequest(JSON.parse(event.body || "{}"));
    const result = await processRefundOperation({ request, dependencies: dependenciesForRefund() });
    const complete = ["succeeded", "already_succeeded"].includes(result.outcome);

    return {
      statusCode: complete ? 200 : 409,
      body: JSON.stringify({
        success: complete,
        operationId: result.operationId,
        outcome: result.outcome,
        refundedAmount: result.refundedAmount,
        policy: result.policy_label || null,
        action: request.action,
      }),
    };
  } catch (error) {
    console.error("Erreur refund-booking-payment :", error);
    if (error instanceof SyntaxError) {
      return { statusCode: 400, body: JSON.stringify({ code: "invalid_json", error: "Corps JSON invalide." }) };
    }
    if (error instanceof RefundOperationError) {
      const statusCode = error.code === "refund_operation_conflict" ? 409
        : error.code.startsWith("invalid_") ? 400
          : 500;
      return { statusCode, body: JSON.stringify({ code: error.code, error: error.message }) };
    }
    return { statusCode: 500, body: JSON.stringify({ code: "refund_failed", error: error.message }) };
  }
}
