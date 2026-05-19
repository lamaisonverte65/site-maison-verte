import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

function getReasonLabel(reason) {
  const labels = {
    acompte: "Acompte",
    solde: "Solde",
    complement: "Complément",
    autre: "Paiement",
  };

  return labels[reason] || "Paiement";
}

function getSessionPaidAmount(session, fallback = 0) {
  if (typeof session.amount_total === "number") {
    return Number(session.amount_total) / 100;
  }

  return Number(fallback || 0);
}

function getTotalDue(booking, session) {
  return Number(
    booking.owner_price ||
      booking.estimated_total ||
      session.metadata?.total_price ||
      0
  );
}

function getPreviousPaid(booking) {
  return Number(booking.amount_paid || booking.total_paid || 0);
}

function isAlreadyProcessed(booking, session) {
  return booking?.stripe_checkout_session_id === session.id;
}

async function sendPaymentConfirmationEmail(booking, paymentType, extra = {}) {
  const total = Number(booking.owner_price || booking.estimated_total || 0);
  const deposit = Number(booking.deposit_amount || Math.round(total * 0.3));
  const balance = Number(booking.balance_amount || Math.max(total - deposit, 0));
  const arrivalUrl = `https://lamaisonverte65.fr/arrival?booking=${booking.id}`;

  const isFull = paymentType === "full" || extra.isFullyPaid;
  const isBalance = paymentType === "balance";
  const isManual = paymentType === "manual";
  const manualReason = extra.manualReason || booking.manual_payment_reason || "autre";
  const manualAmount = Number(extra.manualAmount || booking.manual_payment_amount || 0);

  const title = isFull
    ? "Paiement reçu — réservation soldée ✅"
    : isBalance
    ? "Solde reçu — séjour soldé ✅"
    : isManual
    ? `${getReasonLabel(manualReason)} reçu ✅`
    : "Acompte reçu — réservation confirmée ✅";

  const paymentLine = isFull
    ? `<strong>Total payé :</strong> ${formatCurrency(extra.totalPaid || total)}<br />`
    : isBalance
    ? `<strong>Solde reçu :</strong> ${formatCurrency(balance)}<br /><strong>Total payé :</strong> ${formatCurrency(extra.totalPaid || total)}<br />`
    : isManual
    ? `<strong>${getReasonLabel(manualReason)} reçu :</strong> ${formatCurrency(manualAmount)}<br /><strong>Total payé :</strong> ${formatCurrency(extra.totalPaid || manualAmount)}<br />`
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

      ${paymentType === "deposit" && !extra.isFullyPaid ? "<p>Le solde vous sera demandé environ <strong>30 jours avant votre arrivée</strong>.</p>" : ""}

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
      subject: extra.isFullyPaid
        ? "Paiement reçu - La Maison Verte"
        : paymentType === "full"
        ? "Paiement reçu - La Maison Verte"
        : paymentType === "balance"
        ? "Solde reçu - La Maison Verte"
        : paymentType === "manual"
        ? "Paiement reçu - La Maison Verte"
        : "Acompte reçu - La Maison Verte",
      html,
    }),
  });

  if (!response.ok) {
    console.error("Erreur email paiement reçu :", await response.text());
  }
}

function buildFullPaymentPayload({ total, paidNow, session, now }) {
  return {
    status: "fully_paid",
    payment_status: "paid",
    deposit_amount: 0,
    balance_amount: total,
    deposit_status: "non applicable",
    balance_status: "paid",
    balance_paid_at: now,
    amount_paid: total,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent,
    last_payment_type: "full",
    last_payment_amount: paidNow,
    last_payment_paid_at: now,
    confirmed_at: now,
    updated_at: now,
  };
}

export async function handler(event) {
  try {
    const signature = event.headers["stripe-signature"];
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const bookingId = session.metadata?.booking_id;
      const paymentType = session.metadata?.payment_type || "deposit";

      if (!bookingId) return { statusCode: 400, body: "Missing booking_id" };

      const { data: booking, error: readError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (readError) return { statusCode: 500, body: readError.message };

      // Stripe peut renvoyer le même événement : on évite tout double comptage.
      if (isAlreadyProcessed(booking, session)) {
        console.log("Webhook Stripe déjà traité :", session.id);
        return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
      }

      const total = getTotalDue(booking, session);
      const deposit = Number(
        booking.deposit_amount ||
          session.metadata?.deposit_amount ||
          Math.round(total * 0.3)
      );
      const balance = Number(
        booking.balance_amount ||
          session.metadata?.balance_amount ||
          Math.max(total - deposit, 0)
      );
      const manualAmount = Number(session.metadata?.manual_amount || booking.manual_payment_amount || 0);
      const paidNow = getSessionPaidAmount(session, manualAmount || deposit || balance || total);
      const previousPaid = getPreviousPaid(booking);
      const totalPaidAfter = Math.min(previousPaid + paidNow, total || previousPaid + paidNow);
      const isFullyPaid = total > 0 && totalPaidAfter >= total;
      const now = new Date().toISOString();

      let updatePayload = {};

      if (paymentType === "full") {
        updatePayload = buildFullPaymentPayload({ total, paidNow, session, now });
      }

      if (paymentType === "deposit") {
        updatePayload = {
          status: isFullyPaid ? "fully_paid" : "deposit_paid",
          payment_status: "paid",
          deposit_amount: deposit,
          balance_amount: Math.max(total - totalPaidAfter, 0),
          deposit_status: "paid",
          deposit_paid_at: now,
          balance_status: isFullyPaid ? "paid" : "en attente",
          ...(isFullyPaid ? { balance_paid_at: now } : {}),
          amount_paid: totalPaidAfter,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: "deposit",
          last_payment_amount: paidNow,
          last_payment_paid_at: now,
          confirmed_at: now,
          updated_at: now,
        };
      }

      if (paymentType === "balance") {
        updatePayload = {
          status: isFullyPaid ? "fully_paid" : booking.status,
          payment_status: "paid",
          balance_status: isFullyPaid ? "paid" : "paiement partiel",
          ...(isFullyPaid ? { balance_paid_at: now } : {}),
          balance_amount: Math.max(total - totalPaidAfter, 0),
          amount_paid: totalPaidAfter,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: "balance",
          last_payment_amount: paidNow,
          last_payment_paid_at: now,
          confirmed_at: isFullyPaid ? now : booking.confirmed_at,
          updated_at: now,
        };
      }

      if (paymentType === "manual") {
        const manualReason = session.metadata?.manual_reason || "autre";

        updatePayload = {
          manual_payment_status: "paid",
          manual_payment_paid_at: now,
          amount_paid: totalPaidAfter,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          last_payment_type: `manual:${manualReason}`,
          last_payment_amount: paidNow,
          last_payment_paid_at: now,
          updated_at: now,
        };

        if (manualReason === "acompte") {
          updatePayload.deposit_status = "paid";
          updatePayload.deposit_paid_at = now;
          updatePayload.status = booking.status === "pending" ? "deposit_paid" : booking.status;
        }

        if (manualReason === "solde") {
          updatePayload.balance_status = isFullyPaid ? "paid" : "paiement partiel";
          updatePayload.balance_amount = Math.max(total - totalPaidAfter, 0);
          if (isFullyPaid) updatePayload.balance_paid_at = now;
        }

        // Cas important : paiement manuel total à l’avance, même si le motif est "complément" ou "autre".
        if (isFullyPaid) {
          updatePayload.status = "fully_paid";
          updatePayload.payment_status = "paid";
          updatePayload.balance_status = "paid";
          updatePayload.balance_paid_at = now;
          updatePayload.balance_amount = 0;
          updatePayload.confirmed_at = now;
        }
      }

      const { error: updateError } = await supabase
        .from("booking_requests")
        .update(updatePayload)
        .eq("id", bookingId);

      if (updateError) return { statusCode: 500, body: updateError.message };

      const newStatus = updatePayload.status || booking.status;

      // Dès qu’une réservation devient bloquante, on expire les autres demandes qui se chevauchent.
      if (["deposit", "full", "balance", "manual"].includes(paymentType) && ["deposit_paid", "fully_paid", "confirmed"].includes(newStatus)) {
        await supabase
          .from("booking_requests")
          .update({ status: "expired", updated_at: now })
          .neq("id", bookingId)
          .in("status", ["pending", "accepted"])
          .lt("start_date", booking.end_date)
          .gt("end_date", booking.start_date);
      }

      await sendPaymentConfirmationEmail(
        { ...booking, ...updatePayload },
        paymentType,
        {
          manualReason: session.metadata?.manual_reason,
          manualAmount: paidNow,
          totalPaid: totalPaidAfter,
          isFullyPaid,
        }
      );

      console.log("Paiement Stripe validé :", bookingId, paymentType, {
        paidNow,
        totalPaidAfter,
        total,
        isFullyPaid,
      });
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }
}
