function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
    } = data;

    let subject = "";
    let title = "";
    let content = "";

    const displayedPrice = ownerPrice || estimatedTotal;
    const acceptanceDeadline = formatDateTime(acceptanceExpiresAt);

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
          <strong>Tarif proposé :</strong> ${displayedPrice} €
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
          La réservation sera confirmée après validation finale et paiement des arrhes.
        </p>

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
              Payer les arrhes
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
          <strong>Montant :</strong> ${displayedPrice} €
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

      return {
        statusCode: 500,
        body: JSON.stringify({ error }),
      };
    }

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
