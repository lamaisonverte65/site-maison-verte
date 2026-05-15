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

function buildSubject(type) {
  if (type === "accepted") return "Votre demande a été acceptée - La Maison Verte";
  if (type === "refused") return "Votre demande de réservation - La Maison Verte";
  if (type === "confirmed") return "Réservation confirmée - La Maison Verte";

  return "Votre demande de réservation - La Maison Verte";
}

function buildHtml(data) {
  const fullName = [data.guestFirstName, data.guestLastName]
    .filter(Boolean)
    .join(" ");

  if (data.type === "accepted") {
    return `
      <h2>Votre demande de réservation a été acceptée</h2>

      <p>Bonjour ${fullName || ""},</p>

      <p>
        Nous avons le plaisir de vous informer que votre demande de réservation
        pour La Maison Verte à Arreau est acceptée.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(data.startDate)}<br />
        <strong>Départ :</strong> ${formatDate(data.endDate)}<br />
        <strong>Nombre de nuits :</strong> ${data.nights || "-"}<br />
        <strong>Tarif estimatif initial :</strong> ${formatCurrency(data.estimatedTotal)}<br />
        <strong>Tarif proposé :</strong> ${formatCurrency(data.ownerPrice || data.estimatedTotal)}
      </p>

      <p>
        <strong>Message du propriétaire :</strong><br />
        ${data.ownerMessage || "Votre réservation sera confirmée après validation finale et paiement des arrhes."}
      </p>

      <p>
        Les dates sont provisoirement réservées dans l’attente de la validation définitive.
      </p>

      <p>
        À bientôt dans les Pyrénées 🙂<br />
        La Maison Verte — Arreau
      </p>
    `;
  }

  if (data.type === "refused") {
    return `
      <h2>Votre demande de réservation</h2>

      <p>Bonjour ${fullName || ""},</p>

      <p>
        Nous sommes désolés, mais nous ne pouvons pas donner suite à votre demande
        pour les dates souhaitées.
      </p>

      <p>
        <strong>Arrivée demandée :</strong> ${formatDate(data.startDate)}<br />
        <strong>Départ demandé :</strong> ${formatDate(data.endDate)}
      </p>

      <p>
        <strong>Message du propriétaire :</strong><br />
        ${data.ownerMessage || "Les dates demandées ne sont malheureusement pas disponibles."}
      </p>

      <p>
        Merci pour votre intérêt pour La Maison Verte.<br />
        À bientôt peut-être dans les Pyrénées 🙂
      </p>
    `;
  }

  if (data.type === "confirmed") {
    return `
      <h2>Votre réservation est confirmée</h2>

      <p>Bonjour ${fullName || ""},</p>

      <p>
        Votre réservation à La Maison Verte est confirmée.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(data.startDate)}<br />
        <strong>Départ :</strong> ${formatDate(data.endDate)}<br />
        <strong>Nombre de nuits :</strong> ${data.nights || "-"}<br />
        <strong>Tarif confirmé :</strong> ${formatCurrency(data.ownerPrice || data.estimatedTotal)}
      </p>

      <p>
        <strong>Message du propriétaire :</strong><br />
        ${data.ownerMessage || "Merci pour votre confiance. Nous vous souhaitons un excellent séjour à Arreau."}
      </p>

      <p>
        À bientôt dans les Pyrénées 🙂<br />
        La Maison Verte — Arreau
      </p>
    `;
  }

  return `<p>Notification La Maison Verte</p>`;
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

    if (!data.guestEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Email client manquant",
        }),
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "La Maison Verte <contact@lamaisonverte65.fr>",
        to: [data.guestEmail],
        reply_to: "contact@lamaisonverte65.fr",
        subject: buildSubject(data.type),
        html: buildHtml(data),
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      console.error("Erreur Resend décision :", error);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
      }),
    };
  } catch (error) {
    console.error("Erreur send-booking-decision :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}