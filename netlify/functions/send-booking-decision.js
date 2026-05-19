import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

function getPaymentContext({ paymentType, paymentAmount, displayedPrice, daysBeforeArrival }) {
  const total = Number(displayedPrice || 0);
  const amount = Number(paymentAmount || 0);
  const depositAmount = total > 0 ? Math.round(total * 0.3) : null;
  const days = Number(daysBeforeArrival);

  const isFullPayment = paymentType === "full";

  if (!isFullPayment) {
    return {
      title: "Paiement de l’acompte",
      buttonLabel: "Payer l’acompte",
      amountLabel: "Acompte à payer",
      amountToPay: amount || depositAmount || total,
      explanation: `
        <p>
          La réservation sera confirmée après validation finale et paiement de l’acompte.
        </p>
      `,
      cancellationNote: "",
    };
  }

  if (!Number.isNaN(days) && days <= 7) {
    return {
      title: "Paiement du séjour",
      buttonLabel: "Payer le séjour",
      amountLabel: "Montant total à payer",
      amountToPay: amount || total,
      explanation: `
        <p>
          La date d’arrivée étant proche, le montant total du séjour est demandé pour confirmer la réservation.
        </p>

        <p>
          Conformément aux conditions de location, pour une réservation effectuée à moins de 7 jours de l’arrivée,
          les sommes versées ne pourront pas être remboursées en cas d’annulation par le locataire.
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
        En cas d’annulation entre 30 jours et 7 jours avant l’arrivée,
        l’équivalent de l’acompte reste acquis, mais le solde versé pourra être remboursé
        selon les conditions de location.
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

  try {
    const data = JSON.parse(event.body || "{}");

    const {
      bookingId,
      type,
      guestEmail,
      guestFirstName,
      guestLastName,
      startDate,
      endDate,
      nights,
      estimatedTotal,
      ownerPrice,
      ownerMessage,
      arrivalTime,
      acceptanceExpiresAt,
      paymentLink,
      paymentType,
      paymentAmount,
      daysBeforeArrival,
    } = data;

    let subject = "";
    let title = "";
    let content = "";

    const displayedPrice = ownerPrice || estimatedTotal;
    const acceptanceDeadline = formatDateTime(acceptanceExpiresAt);
    const paymentContext = getPaymentContext({
      paymentType,
      paymentAmount,
      displayedPrice,
      daysBeforeArrival,
    });

    if (type === "accepted") {
      subject = "Votre demande est acceptée - La Maison Verte";
      title = "Votre demande est acceptée ✅";

      content = `
        <p>Bonjour ${guestFirstName || ""} ${guestLastName || ""},</p>

        <p>
          Nous avons le plaisir de vous informer que votre demande de réservation
          pour <strong>La Maison Verte à Arreau</strong> a été acceptée.
        </p>

        <p>
          <strong>Arrivée :</strong> ${startDate}<br />
          <strong>Départ :</strong> ${endDate}<br />
          <strong>Nombre de nuits :</strong> ${nights}<br />
          <strong>Tarif du séjour :</strong> ${formatMoney(displayedPrice)}<br />
          <strong>${paymentContext.amountLabel} :</strong> ${formatMoney(paymentContext.amountToPay)}
        </p>

        ${
          ownerMessage
            ? `
          <p>
            <strong>Message :</strong><br />
            ${ownerMessage}
          </p>
        `
            : ""
        }

        ${paymentContext.explanation}

        <p>
          Vous disposez de <strong>24h</strong> pour procéder au paiement${
            acceptanceDeadline
              ? `, soit jusqu’au <strong>${acceptanceDeadline}</strong>`
              : ""
          }.
        </p>

        <p>
          Passé ce délai, les dates pourront être remises à disposition.
        </p>

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
          Merci de nous communiquer votre heure d’arrivée estimée
          afin d’organiser votre accueil dans les meilleures conditions 🙂
        </p>
      `;
    }

    if (type === "refused") {
      subject = "Votre demande de réservation - La Maison Verte";
      title = "Votre demande n’a pas pu être acceptée";

      content = `
        <p>Bonjour ${guestFirstName || ""} ${guestLastName || ""},</p>

        <p>
          Nous sommes désolés, mais votre demande de réservation
          n’a malheureusement pas pu être acceptée.
        </p>

        ${
          ownerMessage
            ? `
          <p>
            <strong>Message :</strong><br />
            ${ownerMessage}
          </p>
        `
            : ""
        }

        <p>
          Nous espérons pouvoir vous accueillir une prochaine fois
          dans les Pyrénées 🙂
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
            ${ownerMessage}
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
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Erreur Resend :", error);
      await logEmail({ bookingId, emailType: `booking_decision:${type}`, toEmail: guestEmail, subject, status: "error", errorMessage: error });

      return {
        statusCode: 500,
        body: JSON.stringify({ error }),
      };
    }

    let responseData = null;
    try { responseData = await response.json(); } catch (_) {}
    await logEmail({ bookingId, emailType: `booking_decision:${type}`, toEmail: guestEmail, subject, status: "sent", providerId: responseData?.id || null });

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
