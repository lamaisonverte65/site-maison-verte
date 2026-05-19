import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function logBookingEvent({ bookingId, eventType, label, message, metadata = {} }) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: eventType,
    label,
    message,
    metadata,
  }]);
  if (error) console.error("Erreur log booking_events:", error.message);
}

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId || null,
    email_type: emailType,
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    sent_at: new Date().toISOString(),
  }]);
  if (error) console.error("Erreur log email_logs:", error.message);
}

async function upsertPayment({ bookingId, session, paymentType, amount, manualReason = null }) {
  if (!bookingId || !session?.id) return;
  const { error } = await supabase.from("payments").upsert({
    booking_request_id: bookingId,
    payment_type: paymentType,
    manual_reason: manualReason,
    amount: Number(amount || 0),
    currency: session.currency || "eur",
    status: "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent || null,
    customer_email: session.customer_email || session.customer_details?.email || null,
    paid_at: new Date().toISOString(),
    metadata: session.metadata || {},
  }, { onConflict: "stripe_checkout_session_id" });

  if (error) console.error("Erreur upsert payments:", error.message);
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

function getTotalDueAfterPayment(booking, paymentType, manualReason, paidAmount) {
  const currentTotal = Number(booking.owner_price || booking.estimated_total || 0);

  // Cas métier important : paiement manuel "total" = tarif final convenu.
  // Exemple : séjour affiché 240 €, tarif promo accepté 200 €, paiement 200 € => séjour soldé.
  if (paymentType === "manual" && manualReason === "total") {
    return paidAmount;
  }

  return currentTotal;
}

async function sendPaymentConfirmationEmail(booking, paymentType, extra = {}) {
  const total = Number(booking.owner_price || booking.estimated_total || 0);
  const deposit = Number(booking.deposit_amount || Math.round(total * 0.3));
  const balance = Number(booking.balance_amount || Math.max(total - deposit, 0));
  const arrivalUrl = `https://lamaisonverte65.fr/arrival?booking=${booking.id}`;

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
    ? `<strong>Solde reçu :</strong> ${formatCurrency(balance)}<br /><strong>Total payé :</strong> ${formatCurrency(total)}<br />`
    : isManual
    ? `<strong>${getReasonLabel(manualReason)} reçu :</strong> ${formatCurrency(manualAmount)}<br />`
    : `<strong>Acompte reçu :</strong> ${formatCurrency(deposit)}<br /><strong>Solde restant :</strong> ${formatCurrency(balance)}`;

  const intro = isFull
    ? "Nous avons bien reçu le paiement de votre séjour à <strong>La Maison Verte à Arreau</strong>."
    : isBalance
    ? "Nous avons bien reçu le paiement du solde de votre séjour à <strong>La Maison Verte à Arreau</strong>."
    : isManual
    ? "Nous avons bien reçu votre paiement à <strong>La Maison Verte à Arreau</strong>."
    : "Nous avons bien reçu votre acompte pour votre séjour à <strong>La Maison Verte à Arreau</strong>.";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${title}</h2>

      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>

      <p>${intro}</p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}<br />
        <strong>Nombre de nuits :</strong> ${booking.nights || "-"}<br />
        <strong>Montant total :</strong> ${formatCurrency(total)}<br />
        ${paymentLine}
      </p>

      ${paymentType === "deposit" ? "<p>Le solde vous sera demandé environ <strong>30 jours avant votre arrivée</strong>.</p>" : ""}

      <p>
        Merci de nous communiquer votre heure d’arrivée estimée afin d’organiser votre accueil dans les meilleures conditions.
      </p>

      <p style="margin-top:24px;">
        <a href="${arrivalUrl}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          Renseigner mon heure d’arrivée
        </a>
      </p>

      <p>Nous avons hâte de vous accueillir dans les Pyrénées 🌿</p>

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
      subject: isFull ? "Paiement reçu - La Maison Verte" : isBalance ? "Solde reçu - La Maison Verte" : isManual ? "Paiement reçu - La Maison Verte" : "Acompte reçu - La Maison Verte",
      html,
    }),
  });

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
    });
    return;
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
}

export async function handler(event) {
  try {
    const signature = event.headers["stripe-signature"];
    const stripeEvent = stripe.webhooks.constructEvent(event.body, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const bookingId = session.metadata?.booking_id;
      const paymentType = session.metadata?.payment_type || "deposit";

      if (!bookingId) return { statusCode: 400, body: "Missing booking_id" };

      const { data: booking, error: readError } = await supabase.from("booking_requests").select("*").eq("id", bookingId).single();
      if (readError) return { statusCode: 500, body: readError.message };

      const now = new Date().toISOString();
      const manualReason = session.metadata?.manual_reason || booking.manual_payment_reason || "complement";
      const manualAmountFromMetadata = Number(session.metadata?.manual_amount || booking.manual_payment_amount || 0);
      const paidAmount = getCheckoutAmount(session, manualAmountFromMetadata);

      const currentTotal = Number(booking.owner_price || booking.estimated_total || session.metadata?.total_price || 0);
      const totalDue = getTotalDueAfterPayment(booking, paymentType, manualReason, paidAmount);
      const deposit = Number(booking.deposit_amount || session.metadata?.deposit_amount || Math.round(totalDue * 0.3));
      const balance = Number(booking.balance_amount || session.metadata?.balance_amount || Math.max(totalDue - deposit, 0));
      const previousPaid = Number(booking.amount_paid || booking.total_paid || 0);
      const newTotalPaid = paymentType === "full" ? totalDue : previousPaid + paidAmount;
      const fullyPaid = totalDue > 0 && newTotalPaid >= totalDue;

      let updatePayload = {};

      if (paymentType === "full") {
        updatePayload = {
          status: "fully_paid",
          payment_status: "paid",
          deposit_amount: 0,
          balance_amount: totalDue,
          deposit_status: "non applicable",
          balance_status: "paid",
          balance_paid_at: now,
          amount_paid: totalDue,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: "full",
          last_payment_amount: totalDue,
          last_payment_paid_at: now,
          confirmed_at: now,
          updated_at: now,
        };
      }

      if (paymentType === "deposit") {
        updatePayload = {
          status: "deposit_paid",
          payment_status: "paid",
          deposit_amount: paidAmount || deposit,
          balance_amount: Math.max(totalDue - (paidAmount || deposit), 0),
          deposit_status: "paid",
          deposit_paid_at: now,
          balance_status: "en attente",
          amount_paid: paidAmount || deposit,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: "deposit",
          last_payment_amount: paidAmount || deposit,
          last_payment_paid_at: now,
          confirmed_at: now,
          updated_at: now,
        };
      }

      if (paymentType === "balance") {
        updatePayload = {
          status: fullyPaid ? "fully_paid" : "paid",
          payment_status: "paid",
          balance_status: fullyPaid ? "paid" : "partiellement payé",
          balance_paid_at: fullyPaid ? now : booking.balance_paid_at || null,
          amount_paid: newTotalPaid,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: "balance",
          last_payment_amount: paidAmount || balance,
          last_payment_paid_at: now,
          confirmed_at: now,
          updated_at: now,
        };
      }

      if (paymentType === "manual") {
        const manualPayload = {
          manual_payment_status: "paid",
          manual_payment_paid_at: now,
          manual_payment_amount: paidAmount,
          manual_payment_reason: manualReason,
          amount_paid: newTotalPaid,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: `manual:${manualReason}`,
          last_payment_amount: paidAmount,
          last_payment_paid_at: now,
          updated_at: now,
        };

        if (manualReason === "total") {
          const discountAmount = Number(booking.estimated_total || currentTotal || 0) - paidAmount;
          updatePayload = {
            ...manualPayload,
            status: "fully_paid",
            payment_status: "paid",
            owner_price: paidAmount,
            amount_paid: paidAmount,
            deposit_amount: 0,
            balance_amount: paidAmount,
            deposit_status: "non applicable",
            balance_status: "paid",
            balance_paid_at: now,
            discount_amount: discountAmount > 0 ? discountAmount : booking.discount_amount || 0,
            discount_reason: discountAmount > 0 ? "Paiement total manuel / tarif promo" : booking.discount_reason || null,
            confirmed_at: now,
          };
        } else if (manualReason === "acompte") {
          updatePayload = {
            ...manualPayload,
            status: fullyPaid ? "fully_paid" : "deposit_paid",
            payment_status: "paid",
            deposit_amount: paidAmount,
            deposit_status: "paid",
            deposit_paid_at: now,
            balance_amount: Math.max(totalDue - newTotalPaid, 0),
            balance_status: fullyPaid ? "paid" : "en attente",
            balance_paid_at: fullyPaid ? now : booking.balance_paid_at || null,
            confirmed_at: now,
          };
        } else if (manualReason === "solde") {
          updatePayload = {
            ...manualPayload,
            status: fullyPaid ? "fully_paid" : "paid",
            payment_status: "paid",
            balance_status: fullyPaid ? "paid" : "partiellement payé",
            balance_amount: Math.max(totalDue - Number(booking.deposit_amount || 0), 0),
            balance_paid_at: fullyPaid ? now : booking.balance_paid_at || null,
            confirmed_at: now,
          };
        } else if (manualReason === "complement") {
          updatePayload = {
            ...manualPayload,
            status: fullyPaid ? "fully_paid" : "paid",
            payment_status: "paid",
            balance_status: fullyPaid ? "paid" : (booking.balance_status || "partiellement payé"),
            balance_paid_at: fullyPaid ? now : booking.balance_paid_at || null,
            confirmed_at: now,
          };
        }
      }

      const { error: updateError } = await supabase.from("booking_requests").update(updatePayload).eq("id", bookingId);
      if (updateError) return { statusCode: 500, body: updateError.message };

      await upsertPayment({
        bookingId,
        session,
        paymentType,
        manualReason: paymentType === "manual" ? manualReason : null,
        amount: updatePayload.last_payment_amount || paidAmount,
      });

      await logBookingEvent({
        bookingId,
        eventType: "payment_received",
        label: paymentType === "manual" ? `Paiement manuel reçu : ${getReasonLabel(manualReason)}` : `Paiement reçu : ${paymentType}`,
        message: `Montant reçu : ${formatCurrency(updatePayload.last_payment_amount || paidAmount)}`,
        metadata: { paymentType, manualReason, sessionId: session.id, paymentIntentId: session.payment_intent, amount: updatePayload.last_payment_amount || paidAmount },
      });

      if (["deposit", "full", "balance", "manual"].includes(paymentType)) {
        await supabase.from("booking_requests").update({ status: "expired", updated_at: now })
          .neq("id", bookingId)
          .in("status", ["pending", "accepted"])
          .lt("start_date", booking.end_date)
          .gt("end_date", booking.start_date);
      }

      await sendPaymentConfirmationEmail({ ...booking, ...updatePayload }, paymentType, {
        manualReason,
        manualAmount: paidAmount,
      });

      console.log("Paiement Stripe validé :", bookingId, paymentType, manualReason, paidAmount);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }
}
