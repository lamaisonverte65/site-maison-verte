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
      guestEmail,
      guestFirstName,
      guestLastName,
      amount,
      reason,
      message,
      paymentLink,
      startDate,
      endDate,
    } = data;

    if (!guestEmail || !amount || !paymentLink) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "guestEmail, amount et paymentLink sont obligatoires.",
        }),
      };
    }

    const reasonLabel = reason || "Paiement complémentaire";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        
<h2 style="color:#14532d;">Paiement demandé — La Maison Verte</h2>

<p>
  Bonjour,
</p>

<p>
  Merci encore pour votre réservation à <strong>La Maison Verte à Arreau</strong>.
</p>

<p>
  Vous trouverez ci-dessous les informations concernant ce règlement.
</p>


        <p>
          Bonjour ${guestFirstName || ""} ${guestLastName || ""},
        </p>

        <p>
          Un règlement est actuellement nécessaire pour votre réservation à
          <strong>La Maison Verte à Arreau</strong>.
        </p>

        ${
          startDate || endDate
            ? `
          <p>
            <strong>Arrivée :</strong> ${startDate || "-"}<br />
            <strong>Départ :</strong> ${endDate || "-"}
          </p>
        `
            : ""
        }

        <p>
          <strong>Motif :</strong> ${reasonLabel}<br />
          <strong>Montant à régler :</strong> ${amount} €
        </p>

        ${
          message
            ? `
          <p>
            <strong>Message :</strong><br />
            ${message}
          </p>
        `
            : ""
        }

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
            Procéder au paiement
          </a>
        </p>

        <p>
          Le paiement s’effectue via Stripe par lien sécurisé.
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
        to: [guestEmail],
        reply_to: "contact@lamaisonverte65.fr",
        subject: `Paiement demandé - La Maison Verte`,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      console.error("Erreur Resend paiement manuel :", error);

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