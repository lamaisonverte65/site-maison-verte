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

async function sendDepositPaidEmail(booking) {
  const total = Number(booking.owner_price || booking.estimated_total || 0);
  const deposit = Math.round(total * 0.3);
  const balance = Math.max(total - deposit, 0);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Acompte reçu — réservation confirmée ✅</h2>

      <p>
        Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},
      </p>

      <p>
        Nous avons bien reçu votre acompte pour votre séjour à
        <strong>La Maison Verte à Arreau</strong>.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}<br />
        <strong>Nombre de nuits :</strong> ${booking.nights || "-"}<br />
        <strong>Montant total :</strong> ${formatCurrency(total)}<br />
        <strong>Acompte reçu :</strong> ${formatCurrency(deposit)}<br />
        <strong>Solde restant :</strong> ${formatCurrency(balance)}
      </p>

      <p>
        Le solde vous sera demandé environ <strong>30 jours avant votre arrivée</strong>.
      </p>

      <p>
        Merci également de nous communiquer votre heure d’arrivée estimée
        afin d’organiser votre accueil dans les meilleures conditions.
      </p>

      <p>
        Nous avons hâte de vous accueillir dans les Pyrénées 🌿
      </p>

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams
        si vous ne recevez pas nos prochains messages,
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
      subject: "Acompte reçu - La Maison Verte",
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Erreur email acompte reçu :", error);
  }
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

      if (!bookingId) {
        return {
          statusCode: 400,
          body: "Missing booking_id",
        };
      }

      const { data: booking, error: readError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (readError) {
        console.error(readError);

        return {
          statusCode: 500,
          body: readError.message,
        };
      }

      const { error: updateError } = await supabase
        .from("booking_requests")
        .update({
          status: "deposit_paid",
          payment_status: "paid",
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (updateError) {
        console.error(updateError);

        return {
          statusCode: 500,
          body: updateError.message,
        };
      }

      await supabase
        .from("booking_requests")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .neq("id", bookingId)
        .in("status", ["pending", "accepted"])
        .lt("start_date", booking.end_date)
        .gt("end_date", booking.start_date);

      await sendDepositPaidEmail(booking);

      console.log("Acompte reçu et réservation mise à jour :", bookingId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        received: true,
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 400,
      body: `Webhook Error: ${error.message}`,
    };
  }
}