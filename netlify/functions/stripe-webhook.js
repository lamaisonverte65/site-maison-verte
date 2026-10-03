import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { escapeHtml } from "./_lib/html.js";
import { processCheckoutSessionCompleted } from "./_lib/stripe-checkout-completed.js";
import { listAllBalanceTransactions } from "./_lib/stripe-balance-transactions.js";
import { contractualDeposit, contractualTotal, remainingContractualDue } from "./_lib/booking-financial-authority.js";
import { resendEmail } from "./_lib/resend-email.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null, retryPayload = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId || null,
    email_type: emailType,
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    retry_payload: retryPayload,
    sent_at: new Date().toISOString(),
  }]);
  if (error) console.error("Erreur log email_logs:", error.message);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function getReasonLabel(reason) {
  const labels = {
    acompte: "Acompte",
    solde: "Solde",
    total: "Paiement total / tarif promo",
    complement: "Complément",
  };
  return labels[reason] || "Paiement";
}

function getCheckoutAmount(session, fallback = 0) {
  if (typeof session.amount_total === "number") return session.amount_total / 100;
  return Number(fallback || 0);
}

async function getStripeFinancialDetails(session) {
  const fallbackAmount = getCheckoutAmount(session, 0);

  const emptyResult = {
    stripeFeeAmount: 0,
    stripeNetAmount: null,
    stripeGrossAmount: fallbackAmount,
    stripeBalanceTransactionId: null,
    stripeChargeId: null,
    stripePaymentIntentId: session?.payment_intent || null,
  };

  if (!session?.payment_intent) return emptyResult;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
      expand: ["latest_charge.balance_transaction"],
    });

    const charge = paymentIntent.latest_charge;
    const balanceTransaction = charge?.balance_transaction;

    if (!balanceTransaction || typeof balanceTransaction !== "object") {
      return {
        ...emptyResult,
        stripeChargeId: typeof charge === "string" ? charge : charge?.id || null,
        stripePaymentIntentId: paymentIntent.id || session.payment_intent,
      };
    }

    return {
      stripeFeeAmount: Number(balanceTransaction.fee || 0) / 100,
      stripeNetAmount: Number(balanceTransaction.net || 0) / 100,
      stripeGrossAmount: Number(balanceTransaction.amount || 0) / 100,
      stripeBalanceTransactionId: balanceTransaction.id || null,
      stripeChargeId: typeof charge === "string" ? charge : charge?.id || null,
      stripePaymentIntentId: paymentIntent.id || session.payment_intent,
    };
  } catch (error) {
    console.error("Erreur récupération frais/net Stripe:", error.message);
    return emptyResult;
  }
}

function stripeTimestampToIso(timestamp) {
  if (!timestamp) return null;
  return new Date(Number(timestamp) * 1000).toISOString();
}


async function findBookingAndPaymentByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return { booking: null, payment: null };

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (payment?.booking_request_id) {
    const { data: booking } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", payment.booking_request_id)
      .maybeSingle();
    return { booking, payment };
  }

  const { data: booking } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  return { booking, payment: null };
}

async function upsertStripePayout(payout, transactions = []) {
  if (!payout?.id) return null;

  const transactionNetTotal = (transactions || []).reduce((sum, item) => sum + Number(item.net || 0) / 100, 0);
  const amount = Number(payout.amount || 0) / 100;

  const payload = {
    id: payout.id,
    amount,
    currency: payout.currency || "eur",
    status: payout.status || null,
    arrival_date: stripeTimestampToIso(payout.arrival_date || null),
    created_at_stripe: stripeTimestampToIso(payout.created || null),
    reconciled_at: new Date().toISOString(),
    transaction_count: transactions.length,
    expected_net_total: transactionNetTotal,
    difference_amount: Number((amount - transactionNetTotal).toFixed(2)),
    raw: payout,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("stripe_payouts").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return payload;
}

async function recomputeBookingFinancialAggregates(bookingId) {
  if (!bookingId) return null;
  const { data, error } = await supabase.rpc("recompute_booking_financial_aggregates", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data;
}

async function upsertStripeBalanceTransaction(transaction, payout = null) {
  if (!transaction?.id) return null;

  let paymentIntentId = null;
  let chargeId = null;
  const sourceObject = transaction.source;

  if (typeof sourceObject === "object" && sourceObject) {
    chargeId = sourceObject.id || null;
    paymentIntentId = sourceObject.payment_intent || null;
  }

  const { booking, payment } = await findBookingAndPaymentByPaymentIntent(paymentIntentId);
  const payoutId = payout?.id || (typeof transaction.payout === "string" ? transaction.payout : transaction.payout?.id || null);
  const payoutStatus = payout?.status || (payoutId ? "paid" : null);
  const reconciliationStatus = payoutId
    ? (payoutStatus === "paid" ? "viré" : "payout_en_cours")
    : "en_attente_payout";

  const payload = {
    id: transaction.id,
    booking_request_id: booking?.id || payment?.booking_request_id || null,
    payment_id: payment?.id || null,
    payment_type: payment?.payment_type || null,
    payment_intent_id: paymentIntentId,
    charge_id: chargeId,
    payout_id: payoutId,
    type: transaction.type || null,
    reporting_category: transaction.reporting_category || null,
    amount: Number(transaction.amount || 0) / 100,
    fee: Number(transaction.fee || 0) / 100,
    net: Number(transaction.net || 0) / 100,
    currency: transaction.currency || "eur",
    available_on: stripeTimestampToIso(transaction.available_on || null),
    created_at_stripe: stripeTimestampToIso(transaction.created || null),
    description: transaction.description || null,
    reconciliation_status: reconciliationStatus,
    raw: transaction,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("stripe_balance_transactions").upsert(payload, { onConflict: "id" });
  if (error) throw error;

  if (payload.booking_request_id && payload.payout_id) {
    const { error: bookingError } = await supabase
      .from("booking_requests")
      .update({
        stripe_payout_id: payload.payout_id,
        stripe_payout_status: payoutStatus || "paid",
        stripe_payout_arrival_date: stripeTimestampToIso(payout?.arrival_date || null),
        transfer_date: stripeTimestampToIso(payout?.arrival_date || null),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.booking_request_id);

    if (bookingError) throw bookingError;
  }

  return payload;
}

async function reconcilePayout(payout) {
  if (!payout?.id) return { updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;

  try {
    const balanceTransactions = await listAllBalanceTransactions(stripe, {
      payout: payout.id,
      expand: ["data.source"],
    });

    await upsertStripePayout(payout, balanceTransactions);
    const affectedBookingIds = new Set();

    for (const transaction of balanceTransactions) {
      try {
        const row = await upsertStripeBalanceTransaction(transaction, payout);
        if (row?.booking_request_id) {
          affectedBookingIds.add(row.booking_request_id);
          updated += 1;
        }
        else skipped += 1;
      } catch (error) {
        console.error("Erreur transaction payout Stripe:", transaction.id, error.message);
        skipped += 1;
      }
    }

    for (const bookingId of affectedBookingIds) {
      await recomputeBookingFinancialAggregates(bookingId);
    }
  } catch (error) {
    console.error("Erreur rapprochement payout Stripe:", error.message);
  }

  return { updated, skipped };
}

async function sendPaymentConfirmationEmail(booking, paymentType, extra = {}) {
  const total = contractualTotal(booking);
  const deposit = contractualDeposit(booking);
  const balance = remainingContractualDue(booking);
  const arrivalUrl = extra.arrivalToken && booking?.id
    ? `https://lamaisonverte65.fr/arrival?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(extra.arrivalToken)}`
    : null;

  const isFull = paymentType === "full";
  const isBalance = paymentType === "balance";
  const isManual = paymentType === "manual";
  const manualReason = extra.manualReason || booking.manual_payment_reason || "complement";
  const manualAmount = Number(extra.manualAmount || booking.manual_payment_amount || 0);

  const title = isFull
    ? "Paiement reçu — réservation soldée ✅"
    : isBalance
    ? "Solde reçu — séjour soldé ✅"
    : isManual
    ? `${getReasonLabel(manualReason)} reçu ✅`
    : "Acompte reçu — réservation confirmée ✅";

  const paymentLine = isFull
    ? `<strong>Total payé :</strong> ${formatCurrency(total)}<br />`
    : isBalance
    ? `<strong>Solde reçu :</strong> ${formatCurrency(manualAmount)}<br /><strong>Total payé :</strong> ${formatCurrency(total)}<br />`
    : isManual
    ? `<strong>${getReasonLabel(manualReason)} reçu :</strong> ${formatCurrency(manualAmount)}<br />`
    : `<strong>Acompte reçu :</strong> ${formatCurrency(deposit)}<br /><strong>Solde restant :</strong> ${formatCurrency(balance)}`;

  const intro = isFull
    ? "Nous avons bien reçu le paiement de votre séjour à <strong>La Maison Verte à Arreau</strong>."
    : isBalance
    ? "Nous avons bien reçu le paiement du solde de votre séjour à <strong>La Maison Verte à Arreau</strong>."
    : isManual
    ? "Nous avons bien reçu votre paiement à <strong>La Maison Verte à Arreau</strong>."
    : "Nous avons bien reçu votre acompte pour votre séjour à <strong>La Maison Verte à Arreau</strong> et nous vous en remercions.";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${title}</h2>

      <p>Bonjour ${escapeHtml(booking.guest_first_name)} ${escapeHtml(booking.guest_last_name)},</p>

      <p>${intro}</p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}<br />
        <strong>Nombre de nuits :</strong> ${booking.nights || "-"}<br />
        <strong>Montant total :</strong> ${formatCurrency(total)}<br />
        ${paymentLine}
      </p>

      ${paymentType === "deposit" ? `
        <p>Le solde vous sera demandé environ <strong>30 jours avant votre arrivée</strong>.</p>
        <p>À réception du paiement du solde, les informations nécessaires à la préparation de votre séjour vous seront communiquées.</p>
      ` : ""}

      ${(isFull || isBalance) ? `
        <p>
          Les draps ainsi que deux serviettes par personne (une grande serviette 70 × 140 cm et une petite serviette 33 × 50 cm) sont fournis.
        </p>

        <p>
          Les clés seront disponibles dans une boîte à clés. Le code et les dernières informations pratiques vous seront automatiquement envoyés deux jours avant votre arrivée.
        </p>

        <p style="margin:24px 0;">
          <img
            src="https://lamaisonverte65.fr/livret/procedure-boite-a-cles.png"
            alt="Procédure illustrée d’ouverture et de fermeture de la boîte à clés Master Lock 5423EURD"
            style="display:block;width:100%;max-width:720px;height:auto;margin:0 auto;border:0;"
          />
        </p>

        <p>
          <strong>Heure d’arrivée habituelle :</strong> à partir de 16 h.<br />
          <strong>Heure de départ :</strong> avant 10 h.
        </p>

        <p>
          Ces horaires peuvent éventuellement être adaptés en fonction des départs et arrivées précédant ou suivant votre séjour.
          N’hésitez pas à nous contacter si vous souhaitez effectuer une demande particulière.
        </p>

        <p>
          Vous pouvez également consulter dès maintenant notre livret d’accueil, qui regroupe les informations utiles concernant le logement, l’accès, le stationnement et votre séjour.
        </p>

        <p style="margin-top:20px;">
          <a href="https://lamaisonverte65.fr/livret" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">Consulter le livret d’accueil</a>
        </p>

        ${arrivalUrl ? `<p style="margin-top:24px;"><a href="${escapeHtml(arrivalUrl)}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">Renseigner mon heure d’arrivée</a></p>` : ""}
      ` : ""}

      <p>Nous avons hâte de vous accueillir dans les Pyrénées 🌿</p>

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages,
        puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject: isFull ? "Paiement reçu - La Maison Verte" : isBalance ? "Solde reçu - La Maison Verte" : isManual ? "Paiement reçu - La Maison Verte" : "Acompte reçu - La Maison Verte",
      html,
    };
  const response = await resendEmail(retryPayload);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erreur email paiement reçu :", errorText);
    await logEmail({
      bookingId: booking.id,
      emailType: `payment_confirmation:${paymentType}`,
      toEmail: booking.guest_email,
      subject: isFull ? "Paiement reçu - La Maison Verte" : isBalance ? "Solde reçu - La Maison Verte" : isManual ? "Paiement reçu - La Maison Verte" : "Acompte reçu - La Maison Verte",
      status: "error",
      errorMessage: errorText,
      retryPayload,
    });
    return { sent: false, reason: errorText };
  }

  let responseData = null;
  try {
    responseData = await response.json();
  } catch (_) {}

  await logEmail({
    bookingId: booking.id,
    emailType: `payment_confirmation:${paymentType}`,
    toEmail: booking.guest_email,
    subject: isFull ? "Paiement reçu - La Maison Verte" : isBalance ? "Solde reçu - La Maison Verte" : isManual ? "Paiement reçu - La Maison Verte" : "Acompte reçu - La Maison Verte",
    status: "sent",
    providerId: responseData?.id || null,
  });
  return { sent: true, providerId: responseData?.id || null };
}

async function sendOwnerPaymentStatusEmail(booking, paymentType, amount, clientEmailResult, manualReason = null) {
  const ownerEmail = process.env.OWNER_EMAIL || "contact@lamaisonverte65.fr";
  const total = contractualTotal(booking);
  const paid = Number(booking.amount_paid || 0);
  const remaining = Math.max(total - paid, 0);
  const name = `${booking.guest_first_name || ""} ${booking.guest_last_name || ""}`.trim() || "Client";
  const adminUrl = `${process.env.URL || "https://lamaisonverte65.fr"}/admin?booking=${encodeURIComponent(booking.id)}`;
  const typeLabel = paymentType === "deposit"
    ? "Acompte reçu"
    : paymentType === "balance"
    ? "Solde reçu"
    : paymentType === "full"
    ? "Paiement intégral reçu"
    : `${getReasonLabel(manualReason || "complement")} reçu`;
  const clientEmailStatus = clientEmailResult?.sent ? "envoyé" : `ÉCHEC${clientEmailResult?.reason ? ` — ${escapeHtml(clientEmailResult.reason)}` : ""}`;
  const subject = `${typeLabel} — ${name} — La Maison Verte`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${typeLabel}</h2><p><strong>Client :</strong> ${escapeHtml(name)}<br><strong>Séjour :</strong> ${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}<br><strong>Montant reçu :</strong> ${formatCurrency(amount)}<br><strong>Total payé :</strong> ${formatCurrency(paid)}<br><strong>Reste à encaisser :</strong> ${formatCurrency(remaining)}<br><strong>Email client :</strong> ${clientEmailStatus}</p><p><a href="${escapeHtml(adminUrl)}" style="background:#166534;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Ouvrir la réservation dans l’admin</a></p></div>`;

  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [ownerEmail],
      subject,
      html,
    };
  const response = await resendEmail(retryPayload);

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, emailType: `owner_payment_status:${paymentType}`, toEmail: ownerEmail, subject, status: "error", errorMessage: errorText, retryPayload});
    console.error("Erreur email propriétaire paiement:", errorText);
    return { sent: false, reason: errorText };
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}
  await logEmail({ bookingId: booking.id, emailType: `owner_payment_status:${paymentType}`, toEmail: ownerEmail, subject, status: "sent", providerId: responseData?.id || null });
  return { sent: true };
}

async function applyCheckoutPayment(payload) {
  const { data, error } = await supabase.rpc("apply_stripe_checkout_payment", {
    p_booking_id: payload.bookingId,
    p_checkout_session_id: payload.checkoutSessionId,
    p_payment_intent_id: payload.paymentIntentId,
    p_payment_type: payload.paymentType,
    p_manual_reason: payload.manualReason,
    p_amount: payload.amount,
    p_currency: payload.currency,
    p_customer_email: payload.customerEmail,
    p_metadata: payload.metadata,
    p_stripe_paid_at: payload.stripePaidAt,
    p_stripe_fee_amount: payload.stripeFeeAmount,
    p_stripe_net_amount: payload.stripeNetAmount,
    p_balance_transaction_id: payload.balanceTransactionId,
    p_charge_id: payload.chargeId,
    p_arrival_token_hash: payload.arrivalTokenHash,
  }).single();

  if (error) throw error;
  return data;
}

export async function handler(event) {
  let stripeEvent;
  try {
    const signature = event.headers["stripe-signature"];
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error(error);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const result = await processCheckoutSessionCompleted({
        session: stripeEvent.data.object,
        stripeEventCreated: stripeEvent.created,
        dependencies: {
          getFinancialDetails: getStripeFinancialDetails,
          applyPayment: applyCheckoutPayment,
          sendConfirmationEmail: async ({ booking, paymentType, manualReason, amount, arrivalToken }) => {
            const clientEmailResult = await sendPaymentConfirmationEmail(booking, paymentType, {
              manualReason,
              manualAmount: amount,
              arrivalToken,
            });
            await sendOwnerPaymentStatusEmail(booking, paymentType, amount, clientEmailResult, manualReason);
          },
        },
      });

      console.log("Traitement Checkout Stripe :", stripeEvent.data.object.id, result.outcome, result.reviewReason || null);
    }

    if (stripeEvent.type === "payout.paid" || stripeEvent.type === "payout.reconciliation_completed") {
      const payout = stripeEvent.data.object;
      console.log("Payout Stripe reçu :", payout.id, payout.status, payout.amount);

      const result = await reconcilePayout(payout);
      console.log("Rapprochement payout terminé :", result);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Webhook processing failed" };
  }
}
