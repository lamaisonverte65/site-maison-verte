import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { escapeHtml } from "./_lib/html.js";
import { contractualDeposit, contractualTotal } from "./_lib/booking-financial-authority.js";
import { resendEmail } from "./_lib/resend-email.js";

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

function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

function daysUntil(dateString, now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00.000Z`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function formatDiscountRate(gross, net) {
  const grossValue = Number(gross || 0);
  const netValue = Number(net || 0);
  if (!(grossValue > 0) || netValue >= grossValue) return null;
  return ((grossValue - netValue) / grossValue * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function getPaymentContext({ paymentType, paymentAmount, displayedPrice, daysBeforeArrival }) {
  const total = Number(displayedPrice || 0);
  const amount = Number(paymentAmount || 0);
  const days = Number(daysBeforeArrival);

  const isFullPayment = paymentType === "full";

  if (!isFullPayment) {
    return {
      title: "Paiement de l’acompte",
      buttonLabel: "Payer l’acompte",
      amountLabel: "Acompte à payer",
      amountToPay: amount || total,
      explanation: `
        <p>
          Pour confirmer définitivement votre réservation, il vous reste simplement à régler l’acompte
          en cliquant sur le bouton ci-dessous.
        </p>
      `,
      cancellationNote: "",
    };
  }

  if (!Number.isNaN(days) && days > 30) {
    return {
      title: "Paiement du séjour",
      buttonLabel: "Payer le séjour",
      amountLabel: "Montant total à payer",
      amountToPay: amount || total,
      explanation: `
        <p>
          Vous avez choisi de régler la totalité du séjour en une seule fois.
          Ce paiement confirmera définitivement votre réservation.
        </p>
      `,
      cancellationNote: "",
    };
  }

  return {
    title: "Paiement du séjour",
    buttonLabel: "Payer le séjour",
    amountLabel: "Montant total à payer",
    amountToPay: amount || total,
    explanation: `
      <p>
        La date d’arrivée étant à moins de 30 jours, le montant total du séjour est demandé pour confirmer la réservation.
      </p>

      <p>
        En cas d’annulation à partir de 30 jours avant l’arrivée,
        l’acompte reste acquis et tout solde déjà versé est remboursé,
        selon les conditions de location. La taxe de séjour est remboursée si le séjour n’a pas lieu.
      </p>
    `,
    cancellationNote: "",
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const adminAuth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.manageReservations, ADMIN_PERMISSIONS.manageCommunication] });
  if (!adminAuth.ok) return authorizationResponse(adminAuth);

  try {
    const data = JSON.parse(event.body || "{}");

    const { bookingId, type, ownerMessage } = data;

    if (!bookingId) return { statusCode: 400, body: JSON.stringify({ error: "bookingId obligatoire." }) };
    const { data: storedBooking, error: bookingError } = await supabase.from("booking_requests").select("*").eq("id", bookingId).single();
    if (bookingError || !storedBooking?.guest_email) return { statusCode: 404, body: JSON.stringify({ error: "Réservation introuvable." }) };
    const recipientEmail = storedBooking.guest_email;
    const safeOwnerMessage = escapeHtml(ownerMessage || "").replace(/\r?\n/g, "<br />");

    const guestFirstName = storedBooking.guest_first_name || "";
    const guestLastName = storedBooking.guest_last_name || "";
    const startDate = storedBooking.start_date;
    const endDate = storedBooking.end_date;
    const nights = storedBooking.nights;
    const arrivalTime = storedBooking.arrival_time;
    const adultsCount = storedBooking.adults_count;
    const childrenCount = storedBooking.children_count;
    const childrenAges = storedBooking.children_ages;
    const babyBedNeeded = storedBooking.baby_bed_needed;
    const acceptanceExpiresAt = storedBooking.acceptance_expires_at;
    const paymentLink = storedBooking.payment_link;
    const paymentType = storedBooking.deposit_status === "non applicable" ? "full" : "deposit";
    const daysBeforeArrival = daysUntil(startDate);

    if (paymentLink) {
      try {
        const url = new URL(paymentLink);
        if (url.protocol !== "https:" || !["checkout.stripe.com", "buy.stripe.com"].includes(url.hostname)) throw new Error("invalid");
        if (storedBooking.stripe_checkout_session_id && !paymentLink.includes(storedBooking.stripe_checkout_session_id)) throw new Error("invalid");
      } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Lien de paiement stocké non autorisé." }) };
      }
    }

    let subject = "";
    let title = "";
    let content = "";

    const displayedPrice = contractualTotal(storedBooking);
    const authoritativePaymentAmount = paymentType === "full"
      ? displayedPrice
      : contractualDeposit(storedBooking);
    const travelersSummary = [
      adultsCount ? `${adultsCount} adulte${Number(adultsCount) > 1 ? "s" : ""}` : null,
      Number(childrenCount || 0) > 0 ? `${childrenCount} enfant${Number(childrenCount) > 1 ? "s" : ""}` : null,
      childrenAges ? `âges : ${childrenAges}` : null,
      babyBedNeeded ? "lit bébé / bébé à prévoir" : null,
    ].filter(Boolean).join(" · ") || "Non renseigné";
    const acceptanceDeadline = formatDateTime(acceptanceExpiresAt);
    const paymentContext = getPaymentContext({
      paymentType,
      paymentAmount: authoritativePaymentAmount,
      displayedPrice,
      daysBeforeArrival,
    });
    const accommodationGross = Number(storedBooking.accommodation_gross ?? storedBooking.accommodation_net ?? 0);
    const accommodationNet = Number(storedBooking.accommodation_net ?? storedBooking.accommodation_gross ?? 0);
    const cleaningApplied = storedBooking.cleaning_option === true ? Number(storedBooking.cleaning_fee || 0) : 0;
    const touristTax = Number(storedBooking.tourist_tax_amount || 0);
    const actualDiscount = Math.max(accommodationGross - accommodationNet, 0);
    const actualDiscountRate = formatDiscountRate(accommodationGross, accommodationNet);

    if (type === "accepted") {
      subject = "Votre demande est acceptée — La Maison Verte";
      title = "Votre demande est acceptée";

      content = `
        <p>Bonjour ${guestFirstName || ""},</p>

        <p>
          Bonne nouvelle, nous pouvons vous accueillir à <strong>La Maison Verte à Arreau</strong>
          aux dates demandées.
        </p>

        <p>
          <strong>Récapitulatif de votre séjour</strong><br />
          Arrivée : ${startDate}<br />
          Départ : ${endDate}<br />
          Nombre de nuits : ${nights}<br />
          Voyageurs : ${travelersSummary}<br />
          Hébergement : ${formatMoney(accommodationNet)}<br />
          ${actualDiscount > 0 ? `Remise appliquée : -${formatMoney(actualDiscount)}${actualDiscountRate ? ` (${actualDiscountRate} %)` : ""}<br />` : ""}
          Ménage : ${formatMoney(cleaningApplied)}<br />
          Taxe de séjour : ${formatMoney(touristTax)}<br />
          <strong>Total du séjour : ${formatMoney(displayedPrice)}</strong><br />
          <strong>${paymentContext.amountLabel} : ${formatMoney(paymentContext.amountToPay)}</strong>
        </p>

        ${paymentContext.explanation}

        ${
          paymentLink
            ? `
          <p style="margin-top:30px;">
            <a
              href="${paymentLink}"
              style="
                background:#16a34a;
                color:white;
                padding:14px 22px;
                border-radius:12px;
                text-decoration:none;
                font-weight:bold;
                display:inline-block;
              "
            >
              ${paymentContext.buttonLabel}
            </a>
          </p>
        `
            : ""
        }

        <p>
          Ce lien est valable pendant <strong>24 h</strong>${
            acceptanceDeadline
              ? `, jusqu’au <strong>${acceptanceDeadline}</strong>`
              : ""
          }. Passé ce délai, en l’absence de paiement, les dates seront à nouveau disponibles.
        </p>

        <p>
          Après votre paiement, vous recevrez un email confirmant définitivement votre réservation.
        </p>

        ${
          paymentType !== "full"
            ? `
          <p>
            Le solde vous sera automatiquement demandé <strong>30 jours avant votre arrivée</strong>.
          </p>
        `
            : ""
        }

        <p>
          Vous pouvez à tout moment consulter le
          <a
            href="https://lamaisonverte65.fr/documents/contrat-location.pdf"
            style="color:#166534;font-weight:bold;text-decoration:none;"
          >contrat de location</a>,
          qui reprend les conditions de votre réservation.
        </p>

        ${
          ownerMessage
            ? `
          <p>${safeOwnerMessage}</p>
        `
            : ""
        }

        <p>
          Au plaisir de vous accueillir,
        </p>

        <p>
          <strong>Raphaël &amp; Emmanuelle</strong><br />
          <a href="tel:+33695938315" style="color:#166534;text-decoration:none;">06 95 93 83 15</a><br />
          <strong>La Maison Verte — Arreau</strong>
        </p>
      `;
    }

    if (type === "refused") {
      subject = "Votre demande de réservation — La Maison Verte";
      title = "Votre demande n’a pas pu être acceptée";

      content = `
        <p>Bonjour ${guestFirstName || ""},</p>

        <p>
          Nous sommes désolés, mais nous ne pouvons malheureusement pas donner suite à votre demande
          de réservation à <strong>La Maison Verte à Arreau</strong> pour le séjour
          du <strong>${startDate}</strong> au <strong>${endDate}</strong>.
        </p>

        ${
          ownerMessage
            ? `
          <p>${safeOwnerMessage}</p>
        `
            : ""
        }

        <p>
          Nous espérons avoir l’occasion de vous accueillir une prochaine fois.
        </p>

        <p>
          <strong>Raphaël &amp; Emmanuelle</strong><br />
          <a href="tel:+33695938315" style="color:#166534;text-decoration:none;">06 95 93 83 15</a><br />
          <strong>La Maison Verte — Arreau</strong>
        </p>
      `;
    }

    if (type === "confirmed") {
      subject = "Votre réservation est confirmée - La Maison Verte";
      title = "Votre réservation est confirmée 🎉";

      content = `
        <p>Bonjour ${guestFirstName || ""} ${guestLastName || ""},</p>

        <p>
          Votre réservation à <strong>La Maison Verte</strong>
          est maintenant confirmée.
        </p>

        <p>
          <strong>Arrivée :</strong> ${startDate}<br />
          <strong>Départ :</strong> ${endDate}<br />
          <strong>Nombre de nuits :</strong> ${nights}<br />
          <strong>Voyageurs :</strong> ${travelersSummary}<br />
          <strong>Montant :</strong> ${formatMoney(displayedPrice)}
        </p>

        ${
          arrivalTime
            ? `
          <p>
            <strong>Heure d’arrivée prévue :</strong>
            ${arrivalTime}
          </p>
        `
            : `
          <p>
            Merci de nous communiquer votre heure d’arrivée estimée 🙂
          </p>
        `
        }

        ${
          ownerMessage
            ? `
          <p>
            <strong>Message :</strong><br />
            ${safeOwnerMessage}
          </p>
        `
            : ""
        }

        <p>
          Nous avons hâte de vous accueillir à Arreau 🌿
        </p>
      `;
    }

    if (!subject || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Type de message invalide." }),
      };
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${title}</h2>
        ${content}

        <p style="margin-top:30px;font-size:13px;color:#666;">
          Pensez à vérifier vos courriers indésirables / spams
          si vous ne recevez pas nos prochains messages,
          puis ajoutez contact@lamaisonverte65.fr à vos contacts.
        </p>
      </div>
    `;

    const retryPayload = {
        from: "La Maison Verte <contact@lamaisonverte65.fr>",
        to: [recipientEmail],
        reply_to: "contact@lamaisonverte65.fr",
        subject,
        html,
      };
    const response = await resendEmail(retryPayload);

    if (!response.ok) {
      const error = await response.text();
      console.error("Erreur Resend :", error);
      await logEmail({ bookingId, emailType: `booking_decision:${type}`, toEmail: recipientEmail, subject, status: "error", errorMessage: error, retryPayload});

      return {
        statusCode: 500,
        body: JSON.stringify({ error }),
      };
    }

    let responseData = null;
    try { responseData = await response.json(); } catch (_) {}
    await logEmail({ bookingId, emailType: `booking_decision:${type}`, toEmail: recipientEmail, subject, status: "sent", providerId: responseData?.id || null });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}
