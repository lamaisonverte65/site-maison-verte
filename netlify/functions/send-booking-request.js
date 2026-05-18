export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const data = JSON.parse(event.body || "{}");
  const adminUrl = "https://lamaisonverte65.fr/admin";

  const ownerEmailHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;">
      <h2>Nouvelle demande de réservation</h2>
      <p><strong>Nom :</strong> ${data.guestFirstName} ${data.guestLastName}</p>
      <p><strong>Email :</strong> ${data.guestEmail}</p>
      <p><strong>Téléphone :</strong> ${data.guestPhone}</p>
      <p><strong>Arrivée :</strong> ${data.startDate}</p>
      <p><strong>Départ :</strong> ${data.endDate}</p>
      <p><strong>Nuits :</strong> ${data.nights}</p>
      <p><strong>Total estimatif :</strong> ${data.total}€</p>
      <p><strong>Message client :</strong><br />${data.guestMessage || "Aucun message"}</p>

      <p style="margin-top:30px;">
        <a href="${adminUrl}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          Ouvrir l’administration
        </a>
      </p>

      <p style="margin-top:20px;font-size:13px;color:#666;">
        Les boutons Accepter / Refuser directement depuis l’email seront ajoutés ensuite via des liens sécurisés à usage unique.
      </p>
    </div>
  `;

  const guestEmailHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;">
      <h2>Votre demande a bien été reçue</h2>

      <p>Bonjour ${data.guestFirstName} ${data.guestLastName},</p>

      <p>Nous avons bien reçu votre demande de réservation pour La Maison Verte à Arreau.</p>

      <p>
        <strong>Arrivée :</strong> ${data.startDate}<br />
        <strong>Départ :</strong> ${data.endDate}<br />
        <strong>Nombre de nuits :</strong> ${data.nights}<br />
        <strong>Total estimatif :</strong> ${data.total}€
      </p>

      <p><strong>Votre message :</strong><br />${data.guestMessage || "Aucun message particulier"}</p>

      <p>Votre demande va être étudiée rapidement avant validation définitive.</p>
      <p>Merci et à bientôt dans les Pyrénées 🙂</p>

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Un email de confirmation vient de vous être envoyé. Pensez à vérifier vos courriers indésirables / spams
        si vous ne le recevez pas rapidement, puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const ownerResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: ["lamaisonverte65@gmail.com"],
      reply_to: "contact@lamaisonverte65.fr",
      subject: "Nouvelle demande de réservation",
      html: ownerEmailHtml,
    }),
  });

  if (!ownerResponse.ok) {
    const error = await ownerResponse.text();
    console.error("Erreur Resend propriétaire :", error);
    return { statusCode: 500, body: JSON.stringify({ error }) };
  }

  const guestResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [data.guestEmail],
      reply_to: "contact@lamaisonverte65.fr",
      subject: "Votre demande de réservation - La Maison Verte",
      html: guestEmailHtml,
    }),
  });

  if (!guestResponse.ok) {
    const error = await guestResponse.text();
    console.error("Erreur Resend client :", error);
    return { statusCode: 500, body: JSON.stringify({ error }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}
