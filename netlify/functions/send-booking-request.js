import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function logEmail({ bookingId = null, emailType, toEmail, subject, status, errorMessage = null, providerId = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId,
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

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const data = JSON.parse(event.body || "{}");

  const travelersSummary = [
    data.adultsCount ? `${data.adultsCount} adulte${Number(data.adultsCount) > 1 ? "s" : ""}` : null,
    Number(data.childrenCount || 0) > 0 ? `${data.childrenCount} enfant${Number(data.childrenCount) > 1 ? "s" : ""}` : null,
    data.childrenAges ? `âges : ${data.childrenAges}` : null,
    data.babyBedNeeded ? "lit bébé / bébé à prévoir" : null,
  ].filter(Boolean).join(" · ") || "Non renseigné";

  const ownerEmailHtml = `
    
<div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b;">
  <h2 style="color:#14532d;">Nouvelle demande de réservation</h2>
  <p>Bonjour Raphaël,</p>
  <p>
    Une nouvelle demande de réservation vient d’être reçue pour
    <strong>La Maison Verte à Arreau</strong>.
  </p>
  <p>
    Voici le récapitulatif de la demande :
  </p>

    <p><strong>Nom :</strong> ${data.guestFirstName} ${data.guestLastName}</p>
    <p><strong>Email :</strong> ${data.guestEmail}</p>
    <p><strong>Téléphone :</strong> ${data.guestPhone}</p>
    <p><strong>Voyageurs :</strong> ${travelersSummary}</p>
    <p><strong>Arrivée :</strong> ${data.startDate}</p>
    <p><strong>Départ :</strong> ${data.endDate}</p>
    <p><strong>Nuits :</strong> ${data.nights}</p>
    <p><strong>Total estimatif :</strong> ${data.total}€</p>
  
<hr style="margin:32px 0 20px;border:none;border-top:1px solid #e5e7eb;" />
<p style="font-size:14px;color:#475569;line-height:1.7;">
  <strong>La Maison Verte</strong><br/>
  Centre historique d’Arreau — Hautes‑Pyrénées<br/>
  <a href="https://lamaisonverte65.fr" style="color:#14532d;">lamaisonverte65.fr</a><br/>
  contact@lamaisonverte65.fr
</p>

</div>
  `;

  const guestEmailHtml = `
    
<div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b;">
  <h2 style="color:#14532d;">Votre demande a bien été reçue</h2>


    <p>Bonjour ${data.guestFirstName} ${data.guestLastName},</p>

    <p>
      Nous avons bien reçu votre demande de réservation
      pour La Maison Verte à Arreau.
    </p>

    <p>
      <strong>Arrivée :</strong> ${data.startDate}<br />
      <strong>Départ :</strong> ${data.endDate}<br />
      <strong>Voyageurs :</strong> ${travelersSummary}<br />
      <strong>Nombre de nuits :</strong> ${data.nights}<br />
      <strong>Total estimatif :</strong> ${data.total}€
    </p>

    <p>
      Votre demande va être étudiée rapidement avant validation définitive.
    </p>

    <p>
      Merci et à bientôt dans les Pyrénées 🙂
    </p>
  
<hr style="margin:32px 0 20px;border:none;border-top:1px solid #e5e7eb;" />
<p style="font-size:14px;color:#475569;line-height:1.7;">
  <strong>La Maison Verte</strong><br/>
  Centre historique d’Arreau — Hautes‑Pyrénées<br/>
  <a href="https://lamaisonverte65.fr" style="color:#14532d;">lamaisonverte65.fr</a><br/>
  contact@lamaisonverte65.fr
</p>

</div>
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
    await logEmail({ emailType: "booking_request:owner", toEmail: "lamaisonverte65@gmail.com", subject: "Nouvelle demande de réservation", status: "error", errorMessage: error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  let ownerResponseData = null;
  try { ownerResponseData = await ownerResponse.json(); } catch (_) {}
  await logEmail({ emailType: "booking_request:owner", toEmail: "lamaisonverte65@gmail.com", subject: "Nouvelle demande de réservation", status: "sent", providerId: ownerResponseData?.id || null });

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
    await logEmail({ emailType: "booking_request:guest", toEmail: data.guestEmail, subject: "Votre demande de réservation - La Maison Verte", status: "error", errorMessage: error });

    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  let guestResponseData = null;
  try { guestResponseData = await guestResponse.json(); } catch (_) {}
  await logEmail({ emailType: "booking_request:guest", toEmail: data.guestEmail, subject: "Votre demande de réservation - La Maison Verte", status: "sent", providerId: guestResponseData?.id || null });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}