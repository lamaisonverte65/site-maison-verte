import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(event, supabaseClient) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { ok: false, statusCode: 401, error: "Session admin manquante." };
  }

  const { data, error } = await supabaseClient.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  const allowed = getAdminEmails();

  if (error || !email) {
    return { ok: false, statusCode: 401, error: "Session admin invalide." };
  }

  if (allowed.length > 0 && !allowed.includes(email)) {
    return { ok: false, statusCode: 403, error: "Compte non autorisé." };
  }

  return { ok: true, user: data.user };
}

function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function fieldProvided(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}


function normalizeBookingKind(value) {
  const kind = String(value || "").toLowerCase();
  if (["site", "client", "admin_client"].includes(kind)) return "site";
  if (kind === "booking") return "booking";
  if (kind === "airbnb") return "airbnb";
  return "personal";
}

function getBookingSource(kind) {
  if (kind === "site") return "admin_client";
  if (kind === "booking") return "booking_import";
  if (kind === "airbnb") return "airbnb_import";
  return "admin_personal";
}

function getBookingContractVersion(kind) {
  if (kind === "site") return "admin_client";
  if (kind === "booking") return "booking_import";
  if (kind === "airbnb") return "airbnb_import";
  return "admin_personal";
}

function getBookingKindLabel(kind) {
  if (kind === "site") return "Réservation client";
  if (kind === "booking") return "Réservation Booking";
  if (kind === "airbnb") return "Réservation Airbnb";
  return "Réservation personnelle";
}

function nightsBetween(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 0);
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T12:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function splitDisplayName(displayName) {
  const clean = cleanText(displayName) || "Réservation personnelle";
  return { firstName: clean, lastName: "" };
}

async function logBookingEvent({ bookingId, eventType, label, message, metadata = {} }) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: eventType,
    label,
    message,
    actor: "admin",
    metadata,
  }]);
  if (error) console.error("Erreur historique booking_events:", error.message);
}

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

async function sendAdminBookingPaymentEmail({ booking, paymentLink, paymentType, paymentAmount, acceptanceExpiresAt, message }) {
  if (!booking?.guest_email) return;

  const isFull = paymentType === "full";
  const subject = isFull
    ? "Paiement de votre séjour - La Maison Verte"
    : "Acompte à régler - La Maison Verte";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2>${isFull ? "Paiement du séjour" : "Acompte de réservation"} — La Maison Verte</h2>

      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>

      <p>
        Votre réservation à <strong>La Maison Verte à Arreau</strong> a été créée par nos soins.
        ${isFull
          ? "Elle sera confirmée après règlement du montant total du séjour."
          : "Elle sera confirmée après règlement de l’acompte. Le solde sera demandé environ 30 jours avant votre arrivée."}
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}<br />
        <strong>Nombre de nuits :</strong> ${booking.nights || "-"}<br />
        <strong>Montant total :</strong> ${formatMoney(booking.owner_price || booking.estimated_total)}<br />
        <strong>Montant à régler maintenant :</strong> ${formatMoney(paymentAmount)}
      </p>

      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}

      <p style="margin-top:30px;">
        <a href="${paymentLink}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          ${isFull ? "Payer le séjour" : "Payer l’acompte"}
        </a>
      </p>

      <p style="font-size:13px;color:#666;">
        Ce lien est valable jusqu’au ${new Date(acceptanceExpiresAt).toLocaleString("fr-FR")}.
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
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, emailType: `admin_booking_payment:${paymentType}`, toEmail: booking.guest_email, subject, status: "error", errorMessage: errorText });
    throw new Error(errorText);
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}
  await logEmail({ bookingId: booking.id, emailType: `admin_booking_payment:${paymentType}`, toEmail: booking.guest_email, subject, status: "sent", providerId: responseData?.id || null });
}

async function findOrCreateCustomer(body, startDate, endDate) {
  const bookingKind = normalizeBookingKind(body.bookingKind);
  if (bookingKind === "personal") return null;

  const firstName = cleanText(body.firstName);
  const lastName = cleanText(body.lastName);
  const email = cleanText(body.email);
  const phone = cleanText(body.phone);
  const customerSource = cleanText(body.customerSource) || getBookingSource(bookingKind);
  const customerNotes = fieldProvided(body, "customerNotes") ? cleanText(body.customerNotes) : undefined;
  const marketingConsent = Boolean(body.marketingConsent);

  if (!firstName || !lastName) {
    throw new Error("Prénom et nom obligatoires pour créer ou mettre à jour la fiche client.");
  }

  let existingCustomer = null;

  if (body.customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", body.customerId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Client sélectionné introuvable.");
    existingCustomer = data;
  }

  if (!existingCustomer && email) {
    const { data } = await supabase.from("customers").select("*").eq("email", email).maybeSingle();
    existingCustomer = data;
  }

  if (!existingCustomer && phone) {
    const { data } = await supabase.from("customers").select("*").eq("phone", phone).maybeSingle();
    existingCustomer = data;
  }

  if (!existingCustomer && firstName && lastName) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .maybeSingle();
    existingCustomer = data;
  }

  const basePayload = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    source: customerSource,
    marketing_consent: marketingConsent,
    last_request_at: new Date().toISOString(),
    last_stay: endDate,
  };

  if (customerNotes) {
    basePayload.notes = customerNotes;
  }

  if (existingCustomer) {
    const { data, error } = await supabase
      .from("customers")
      .update({
        ...basePayload,
        first_stay: existingCustomer.first_stay || startDate,
      })
      .eq("id", existingCustomer.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert([{
      ...basePayload,
      first_stay: startDate,
      booking_count: 0,
      booking_request_count: 1,
      customer_status: "prospect",
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function createCheckoutForBooking({ booking, total }) {
  const arrivalInDays = daysUntil(booking.start_date);
  const paymentType = arrivalInDays !== null && arrivalInDays <= 30 ? "full" : "deposit";
  const depositAmount = Math.round(total * 0.3);
  const balanceAmount = Math.max(total - depositAmount, 0);
  const amountToPay = paymentType === "full" ? total : depositAmount;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: booking.guest_email,
    metadata: {
      booking_id: booking.id,
      payment_type: paymentType,
      total_price: String(total),
      deposit_amount: String(depositAmount),
      balance_amount: String(balanceAmount),
      guest_first_name: booking.guest_first_name || "",
      guest_last_name: booking.guest_last_name || "",
      start_date: booking.start_date || "",
      end_date: booking.end_date || "",
      created_from: "calendar_admin",
    },
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: paymentType === "full" ? "Paiement séjour - La Maison Verte" : "Acompte réservation - La Maison Verte",
            description: `${booking.start_date} → ${booking.end_date}`,
          },
          unit_amount: Math.round(amountToPay * 100),
        },
        quantity: 1,
      },
    ],
    success_url: "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://lamaisonverte65.fr/cancel",
  });

  return { session, paymentType, amountToPay, depositAmount, balanceAmount };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const admin = await requireAdmin(event, supabase);
    if (!admin.ok) {
      return { statusCode: admin.statusCode, body: JSON.stringify({ error: admin.error }) };
    }

    const body = JSON.parse(event.body || "{}");
    const startDate = body.startDate;
    const endDate = body.endDate;

    if (!startDate || !endDate || String(endDate) <= String(startDate)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Période invalide." }) };
    }

    const bookingKind = normalizeBookingKind(body.bookingKind);
    const total = bookingKind === "site" ? Math.max(Number(body.total || 0), 0) : 0;
    const amountPaid = 0;
    const sendPaymentLink = bookingKind === "site" && body.sendPaymentLink !== false;
    const shouldCreatePaymentLink = bookingKind === "site" && total > 0 && sendPaymentLink;
    const nights = nightsBetween(startDate, endDate);
    const clientMessage = cleanText(body.clientMessage);
    const internalNotes = cleanText(body.internalNotes);
    const housekeepingNotes = cleanText(body.housekeepingNotes);
    const acceptanceExpiresAt = shouldCreatePaymentLink ? addHours(24) : null;

    const customer = await findOrCreateCustomer(body, startDate, endDate);

    let guestFirstName = cleanText(body.firstName);
    let guestLastName = cleanText(body.lastName);
    let guestEmail = cleanText(body.email);
    let guestPhone = cleanText(body.phone);
    let source = getBookingSource(bookingKind);
    let contractVersion = getBookingContractVersion(bookingKind);

    if (bookingKind !== "personal" && customer) {
      guestFirstName = customer.first_name || guestFirstName;
      guestLastName = customer.last_name || guestLastName;
      guestEmail = customer.email || guestEmail;
      guestPhone = customer.phone || guestPhone;
    }

    if (bookingKind === "personal") {
      const display = splitDisplayName(body.displayName || `${guestFirstName || ""} ${guestLastName || ""}`.trim());
      guestFirstName = display.firstName;
      guestLastName = display.lastName;
    }

    if (!guestFirstName && bookingKind !== "personal") {
      throw new Error("Nom client manquant.");
    }

    if (shouldCreatePaymentLink && !guestEmail) {
      throw new Error("Email obligatoire pour envoyer un lien de paiement Stripe.");
    }

    const paymentTypePreview = shouldCreatePaymentLink && daysUntil(startDate) !== null && daysUntil(startDate) <= 30 ? "full" : "deposit";
    const depositAmount = shouldCreatePaymentLink && paymentTypePreview !== "full" ? Math.round(total * 0.3) : 0;
    const balanceAmount = shouldCreatePaymentLink
      ? (paymentTypePreview === "full" ? total : Math.max(total - depositAmount, 0))
      : Math.max(total - amountPaid, 0);

    const initialStatus = shouldCreatePaymentLink ? "accepted" : "confirmed";
    const now = new Date().toISOString();

    const { data: booking, error } = await supabase
      .from("booking_requests")
      .insert([{
        customer_id: customer?.id || null,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        start_date: startDate,
        end_date: endDate,
        nights,
        estimated_total: total,
        owner_price: total,
        gross_amount: total,
        amount_paid: shouldCreatePaymentLink ? 0 : amountPaid,
        source,
        status: initialStatus,
        payment_status: shouldCreatePaymentLink ? "pending" : (amountPaid > 0 ? "manual_paid" : "not_required"),
        deposit_amount: shouldCreatePaymentLink ? depositAmount : 0,
        balance_amount: balanceAmount,
        deposit_status: shouldCreatePaymentLink && paymentTypePreview !== "full" ? "à payer" : "non applicable",
        balance_status: shouldCreatePaymentLink ? (paymentTypePreview === "full" ? "à payer" : "en attente") : "non applicable",
        adults_count: Number(body.adults || 0) || null,
        children_count: Number(body.children || 0) || null,
        baby_bed_needed: Boolean(body.babyBedNeeded),
        arrival_time: cleanText(body.arrivalTime),
        // Le champ message est réservé aux textes réellement rédigés par le client.
        // Les consignes propriétaire/ménage restent dans housekeeping_notes.
        message: clientMessage,
        owner_message: internalNotes,
        housekeeping_notes: housekeepingNotes,
        payment_link: null,
        acceptance_expires_at: acceptanceExpiresAt,
        accepted_at: shouldCreatePaymentLink ? now : null,
        confirmed_at: shouldCreatePaymentLink ? null : now,
        contract_accepted: false,
        contract_status: "not_sent",
        contract_version: contractVersion,
        updated_at: now,
      }])
      .select()
      .single();

    if (error) throw error;

    let paymentLink = null;
    let stripeSessionId = null;
    let paymentType = null;
    let paymentAmount = 0;

    if (shouldCreatePaymentLink) {
      const checkout = await createCheckoutForBooking({ booking, total });
      paymentLink = checkout.session.url;
      stripeSessionId = checkout.session.id;
      paymentType = checkout.paymentType;
      paymentAmount = checkout.amountToPay;

      const { error: updateError } = await supabase.from("booking_requests").update({
        payment_link: paymentLink,
        stripe_checkout_session_id: stripeSessionId,
        deposit_amount: paymentType === "full" ? 0 : checkout.depositAmount,
        balance_amount: paymentType === "full" ? total : checkout.balanceAmount,
        deposit_status: paymentType === "full" ? "non applicable" : "à payer",
        balance_status: paymentType === "full" ? "à payer" : "en attente",
        updated_at: new Date().toISOString(),
      }).eq("id", booking.id);

      if (updateError) throw updateError;

      const enrichedBooking = {
        ...booking,
        payment_link: paymentLink,
        stripe_checkout_session_id: stripeSessionId,
        deposit_amount: paymentType === "full" ? 0 : checkout.depositAmount,
        balance_amount: paymentType === "full" ? total : checkout.balanceAmount,
        deposit_status: paymentType === "full" ? "non applicable" : "à payer",
        balance_status: paymentType === "full" ? "à payer" : "en attente",
      };

      await sendAdminBookingPaymentEmail({
        booking: enrichedBooking,
        paymentLink,
        paymentType,
        paymentAmount,
        acceptanceExpiresAt,
        message: internalNotes,
      });

      await logBookingEvent({
        bookingId: booking.id,
        eventType: "admin_booking_payment_link_sent",
        label: paymentType === "full" ? "Lien paiement total envoyé" : "Lien acompte envoyé",
        message: `Lien Stripe envoyé pour ${formatMoney(paymentAmount)}.`,
        metadata: { source: "calendar_admin", bookingKind, total, paymentType, paymentAmount, stripeSessionId },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          booking: enrichedBooking,
          paymentLink,
          paymentType,
          paymentAmount,
        }),
      };
    }

    await logBookingEvent({
      bookingId: booking.id,
      eventType: `${bookingKind}_booking_created_from_calendar`,
      label: `${getBookingKindLabel(bookingKind)} créée`,
      message: housekeepingNotes || "Créée depuis le calendrier admin.",
      metadata: { source: "calendar_admin", bookingKind, total, amountPaid },
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, booking }) };
  } catch (error) {
    console.error("Erreur create-personal-booking :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
