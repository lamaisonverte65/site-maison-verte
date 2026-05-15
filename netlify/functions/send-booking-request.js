export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const data = JSON.parse(event.body || "{}");

  const ownerEmailHtml = `
    <h2>Nouvelle demande de réservation</h2>

    <p>
      <strong>Nom :</strong>
      ${data.guestFirstName} ${data.guestLastName}
    </p>

    <p>
      <strong>Email :</strong>
      ${data.guestEmail}
    </p>

    <p>
      <strong>Téléphone :</strong>
      ${data.guestPhone}
    </p>

    <p>
      <strong>Message client :</strong><br />
      ${data.guestMessage || "Aucun message"}
    </p>

    <hr />

    <p>
      <strong>Arrivée :</strong>
      ${data.startDate}
    </p>

    <p>
      <strong>Départ :</strong>
      ${data.endDate}
    </p>

    <p>
      <strong>Nuits :</strong>
      ${data.nights}
    </p>

    <p>
      <strong>Total estimatif :</strong>
      ${data.total}€
    </p>
  `;

  const guestEmailHtml = `
    <h2>Votre demande a bien été reçue</h2>

    <p>
      Bonjour ${data.guestFirstName} ${data.guestLastName},
    </p>

    <p>
      Nous avons bien reçu votre demande de réservation
      pour La Maison Verte à Arreau.
    </p>

    <p>
      <strong>Arrivée :</strong> ${data.startDate}<br />
      <strong>Départ :</strong> ${data.endDate}<br />
      <strong>Nombre de nuits :</strong> ${data.nights}<br />
      <strong>Total estimatif :</strong> ${data.total}€
    </p>

    <p>
      <strong>Votre message :</strong><br />
      ${data.guestMessage || "Aucun message particulier"}
    </p>

    <p>
      Votre demande va être étudiée rapidement avant validation définitive.
    </p>

    <p>
      Merci et à bientôt dans les Pyrénées 🙂
    </p>
  `;

  const ownerResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: ["lamaisonverte65@gmail.com"],
      reply_to: "contact@lamaisonverte65.fr",
      subject: "Nouvelle demande de réservation",
      html: ownerEmailHtml
    })
  });

  if (!ownerResponse.ok) {
    const error = await ownerResponse.text();

    console.error("Erreur Resend propriétaire :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  const guestResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [data.guestEmail],
      reply_to: "contact@lamaisonverte65.fr",
      subject: "Votre demande de réservation - La Maison Verte",
      html: guestEmailHtml
    })
  });

  if (!guestResponse.ok) {
    const error = await guestResponse.text();

    console.error("Erreur Resend client :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}