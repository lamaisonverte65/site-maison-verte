import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
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

function getButtonLabel(reason) {
  const labels = {
    acompte: "Payer l’acompte",
    solde: "Payer le solde",
    total: "Payer le séjour",
    complement: "Payer le complément",
  };
  return labels[reason] || "Procéder au paiement";
}

async function sendManualPaymentEmail({ guestEmail, guestFirstName, guestLastName, startDate, endDate, amount, reason, message, paymentLink }) {
  const reasonLabel = getReasonLabel(reason);
  const buttonLabel = getButtonLabel(reason);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${reasonLabel} à régler — La Maison Verte</h2>

      <p>Bonjour ${guestFirstName || ""} ${guestLastName || ""},</p>

      <p>
        Un lien de paiement sécurisé vous est envoyé concernant votre séjour à
        <strong>La Maison Verte à Arreau</strong>.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(startDate)}<br />
        <strong>Départ :</strong> ${formatDate(endDate)}<br />
        <strong>Motif :</strong> ${reasonLabel}<br />
        <strong>Montant à payer :</strong> ${formatMoney(amount)}
      </p>

      ${reason === "total" ? `
        <p>
          Ce paiement correspond au montant total convenu pour votre séjour.
          Après règlement, votre réservation sera considérée comme soldée.
        </p>
      ` : ""}

      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}

      <p style="margin-top:30px;">
        <a href="${paymentLink}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          ${buttonLabel}
        </a>
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
      to: [guestEmail],
      reply_to: "contact@lamaisonverte65.fr",
      subject: `${reasonLabel} à régler - La Maison Verte`,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const {
      bookingId,
      guestEmail,
      guestFirstName,
      guestLastName,
      startDate,
      endDate,
      amount,
      reason = "solde",
      message = "",
    } = data;

    const allowedReasons = ["acompte", "solde", "total", "complement"];
    const safeReason = allowedReasons.includes(reason) ? reason : "complement";
    const numericAmount = Number(amount || 0);

    if (!bookingId || !guestEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: "bookingId et guestEmail obligatoires" }) };
    }

    if (!numericAmount || numericAmount <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Montant invalide" }) };
    }

    const reasonLabel = getReasonLabel(safeReason);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: guestEmail,
      metadata: {
        booking_id: bookingId,
        payment_type: "manual",
        manual_reason: safeReason,
        manual_amount: String(numericAmount),
        guest_first_name: guestFirstName || "",
        guest_last_name: guestLastName || "",
        start_date: startDate || "",
        end_date: endDate || "",
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${reasonLabel} - La Maison Verte`,
              description: `${formatDate(startDate)} → ${formatDate(endDate)}`,
            },
            unit_amount: Math.round(numericAmount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://lamaisonverte65.fr/cancel",
    });

    await sendManualPaymentEmail({
      guestEmail,
      guestFirstName,
      guestLastName,
      startDate,
      endDate,
      amount: numericAmount,
      reason: safeReason,
      message,
      paymentLink: session.url,
    });

    const { error } = await supabase.from("booking_requests").update({
      manual_payment_amount: numericAmount,
      manual_payment_link: session.url,
      manual_payment_reason: safeReason,
      manual_payment_message: message,
      manual_payment_status: "à payer",
      manual_payment_requested_at: new Date().toISOString(),
      manual_payment_stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url, sessionId: session.id, amount: numericAmount, reason: safeReason }),
    };
  } catch (error) {
    console.error("Erreur create-manual-payment-session:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
