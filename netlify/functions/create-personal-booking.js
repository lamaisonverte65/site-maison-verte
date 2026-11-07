import { escapeHtml } from "./_lib/html.js";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { DATE_CONFLICT_MESSAGE, isBookingDateConflictError } from "./_lib/public-booking-request.js";
import { calculatePublicBookingQuote, quoteToBookingMoney } from "./_lib/booking-quote.js";
import { resendEmail } from "./_lib/resend-email.js";
import { normalizeGuestLanguage, emailLanguageForAudience, appendGuestLanguage } from "../../shared/guestLocale.js";
import { buildLocalizedAdminBookingPaymentEmail } from "./_lib/guest-secondary-emails.js";
import { adminBookingPaymentMode, adminBookingPaymentState } from "./_lib/admin-booking-modes.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function sendAdminBookingPaymentEmail({ booking, paymentLink, paymentType, paymentAmount, acceptanceExpiresAt, message }) {
  if (!booking?.guest_email) return;

  const isFull = paymentType === "full";
  const subject = isFull
    ? "Paiement de votre séjour - La Maison Verte"
    : "Acompte à régler - La Maison Verte";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2>${isFull ? "Paiement du séjour" : "Acompte de réservation"} — La Maison Verte</h2>

      <p>Bonjour ${escapeHtml(booking.guest_first_name || "")} ${escapeHtml(booking.guest_last_name || "")},</p>

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
        <strong>Montant total :</strong> ${formatMoney(booking.contract_total ?? booking.owner_price ?? booking.estimated_total)}<br />
        <strong>Montant à régler maintenant :</strong> ${formatMoney(paymentAmount)}
      </p>

      ${message ? `<p><strong>Message :</strong><br />${escapeHtml(message)}</p>` : ""}

      <p style="margin-top:30px;">
        <a href="${escapeHtml(paymentLink)}" style="background:#2f4f35;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
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

  const language = emailLanguageForAudience(booking);
  const localized = language === "fr" ? null : buildLocalizedAdminBookingPaymentEmail({ language, booking, paymentLink, paymentType, paymentAmount, acceptanceExpiresAt, message });
  const emailSubject = localized?.subject || subject;
  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject: emailSubject,
      html: localized?.html || html,
    };
  const response = await resendEmail(retryPayload);

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, emailType: `admin_booking_payment:${paymentType}`, toEmail: booking.guest_email, subject: emailSubject, status: "error", errorMessage: errorText, retryPayload});
    throw new Error(errorText);
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}
  await logEmail({ bookingId: booking.id, emailType: `admin_booking_payment:${paymentType}`, toEmail: booking.guest_email, subject: emailSubject, status: "sent", providerId: responseData?.id || null });
}

// Confirmation d'une réservation administrateur sans lien de paiement Stripe.
// Le modèle n'implique jamais que les espèces sont déjà encaissées.
async function sendAdminBookingInformationEmail({ booking, bookingKind, paymentMethod }) {
  if (!booking?.guest_email) return;
  const language = emailLanguageForAudience(booking);
  const personal = bookingKind === "personal";
  const cash = paymentMethod === "cash";
  const translations = {
    fr: { subject: "Confirmation de votre séjour — La Maison Verte", greeting: "Bonjour", intro: "Nous avons enregistré votre séjour à La Maison Verte à Arreau.", arrival: "Arrivée", departure: "Départ", nights: "Nuits", total: "Total du séjour", cash: "Montant à régler en espèces à l'arrivée", note: "Aucun règlement en ligne n'est demandé. Le paiement sera enregistré lorsque les espèces auront été remises.", practical: "Vous recevrez les informations pratiques avant votre arrivée." },
    en: { subject: "Your stay confirmation — La Maison Verte", greeting: "Hello", intro: "We have registered your stay at La Maison Verte in Arreau.", arrival: "Check-in", departure: "Check-out", nights: "Nights", total: "Total stay price", cash: "Cash due on arrival", note: "No online payment is requested. Payment will be recorded when the cash has been received.", practical: "You will receive practical information before arrival." },
    es: { subject: "Confirmación de su estancia — La Maison Verte", greeting: "Hola", intro: "Hemos registrado su estancia en La Maison Verte, Arreau.", arrival: "Llegada", departure: "Salida", nights: "Noches", total: "Total de la estancia", cash: "Importe en efectivo a la llegada", note: "No se solicita ningún pago en línea. Se registrará al recibir el efectivo.", practical: "Recibirá información práctica antes de su llegada." },
  };
  const t = translations[language] || translations.fr;
  const name = [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(" ");
  const confirmationHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
    <h2>${escapeHtml(t.subject)}</h2>
    <p>${escapeHtml(t.greeting)} ${escapeHtml(name)},</p>
    <p>${escapeHtml(t.intro)}</p>
    <p><strong>${escapeHtml(t.arrival)} :</strong> ${formatDate(booking.start_date)}<br>
    <strong>${escapeHtml(t.departure)} :</strong> ${formatDate(booking.end_date)}<br>
    <strong>${escapeHtml(t.nights)} :</strong> ${Number(booking.nights || 0)}</p>
    ${personal ? "" : `<p><strong>${escapeHtml(t.total)} :</strong> ${formatMoney(booking.contract_total)}</p>`}
    ${cash ? `<p><strong>${escapeHtml(t.cash)} :</strong> ${formatMoney(booking.contract_total)}</p><p>${escapeHtml(t.note)}</p>` : ""}
    <p>${escapeHtml(t.practical)}</p></div>`;
  const retryPayload = { from: "La Maison Verte <contact@lamaisonverte65.fr>", to: [booking.guest_email], reply_to: "contact@lamaisonverte65.fr", subject: t.subject, html: confirmationHtml };
  const response = await resendEmail(retryPayload);
  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, emailType: "admin_booking_confirmation", toEmail: booking.guest_email, subject: t.subject, status: "error", errorMessage: errorText, retryPayload });
    throw new Error(errorText);
  }
  const result = await response.json().catch(() => ({}));
  await logEmail({ bookingId: booking.id, emailType: "admin_booking_confirmation", toEmail: booking.guest_email, subject: t.subject, status: "sent", providerId: result?.id || null });
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

async function createCheckoutForBooking({ booking }) {
  const total = Number(booking.contract_total);
  const depositAmount = Number(booking.deposit_amount);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(depositAmount) || depositAmount < 0) {
    throw new Error("Snapshot financier V4.10 incomplet pour le paiement.");
  }
  const arrivalInDays = daysUntil(booking.start_date);
  const paymentType = arrivalInDays !== null && arrivalInDays <= 30 ? "full" : "deposit";
  const balanceAmount = Math.max(total - depositAmount, 0);
  const amountToPay = paymentType === "full" ? total : depositAmount;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"], mode: "payment", customer_email: booking.guest_email,
    metadata: {
      booking_id: booking.id, payment_type: paymentType, total_price: String(total),
      deposit_amount: String(depositAmount), balance_amount: String(balanceAmount),
      guest_first_name: booking.guest_first_name || "", guest_last_name: booking.guest_last_name || "",
      start_date: booking.start_date || "", end_date: booking.end_date || "", created_from: "calendar_admin",
    },
    line_items: [{ price_data: { currency: "eur", product_data: {
      name: paymentType === "full" ? "Paiement séjour - La Maison Verte" : "Acompte réservation - La Maison Verte",
      description: `${booking.start_date} → ${booking.end_date}`,
    }, unit_amount: Math.round(amountToPay * 100) }, quantity: 1 }],
    success_url: appendGuestLanguage("https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}", booking.communication_language),
    cancel_url: appendGuestLanguage("https://lamaisonverte65.fr/cancel", booking.communication_language),
  });
  return { session, paymentType, amountToPay, depositAmount, balanceAmount, total };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const admin = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.manageReservations, ADMIN_PERMISSIONS.manageCalendar] });
    if (!admin.ok) return authorizationResponse(admin);

    const body = JSON.parse(event.body || "{}");
    const startDate = body.startDate;
    const endDate = body.endDate;

    if (!startDate || !endDate || String(endDate) <= String(startDate)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Période invalide." }) };
    }

    const bookingKind = normalizeBookingKind(body.bookingKind);
    const paymentMethod = adminBookingPaymentMode(bookingKind, body.paymentMethod);
    const notificationsEnabled = body.sendInfoEmail !== false && Boolean(cleanText(body.email));
    const specialAccommodation = bookingKind === "site" && body.total !== null && body.total !== undefined && body.total !== ""
      ? Number(body.total)
      : null;
    if (bookingKind === "site" && specialAccommodation !== null && (!Number.isFinite(specialAccommodation) || specialAccommodation < 0)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Tarif spécial d’hébergement invalide." }) };
    }
    const amountPaid = 0;
    const sendPaymentLink = paymentMethod === "stripe" && body.sendPaymentLink !== false;
    const nights = nightsBetween(startDate, endDate);
    const clientMessage = cleanText(body.clientMessage);
    const internalNotes = cleanText(body.internalNotes);
    const housekeepingNotes = cleanText(body.housekeepingNotes);
    const acceptanceExpiresAt = paymentMethod === "stripe" && sendPaymentLink ? addHours(24) : null;

    const customer = await findOrCreateCustomer(body, startDate, endDate);

    let guestFirstName = cleanText(body.firstName);
    let guestLastName = cleanText(body.lastName);
    let guestEmail = cleanText(body.email);
    let guestPhone = cleanText(body.phone);
    let source = getBookingSource(bookingKind);
    let contractVersion = getBookingContractVersion(bookingKind);

    if (customer) {
      guestFirstName = customer.first_name || guestFirstName;
      guestLastName = customer.last_name || guestLastName;
      guestEmail = customer.email || guestEmail;
      guestPhone = customer.phone || guestPhone;
    }

    if (bookingKind === "personal") {
      const display = splitDisplayName(body.displayName || `${guestFirstName || ""} ${guestLastName || ""}`.trim());
      guestFirstName = cleanText(body.firstName) || display.firstName;
      guestLastName = cleanText(body.lastName) || display.lastName;
    }

    if (!guestFirstName && bookingKind !== "personal") {
      throw new Error("Nom client manquant.");
    }

    let financialSnapshot = null;
    if (bookingKind === "site") {
      const adults = Number(body.adults || 0);
      const children = Number(body.children || 0);
      const quote = await calculatePublicBookingQuote(supabase, {
        startDate, endDate, adultsCount: adults, childrenCount: children,
        cleaningOption: body.cleaningOption !== false,
        promotionCode: cleanText(body.promotionCode) || "",
        financialContext: specialAccommodation === null ? {} : { accommodationGrossCents: Math.round(specialAccommodation * 100) },
      });
      financialSnapshot = quoteToBookingMoney(quote);
      financialSnapshot.cleaning_option = body.cleaningOption !== false;
      financialSnapshot.cleaning_fee = Math.round(quote.cleaningFeeCents / 100);
      financialSnapshot.payment_preference = daysUntil(startDate) !== null && daysUntil(startDate) <= 30 ? "full" : (body.paymentPreference === "full" ? "full" : "deposit");
    }
    const total = Number(financialSnapshot?.contract_total || 0);
    const plan = adminBookingPaymentState({ bookingKind, paymentMethod, total, sendPaymentLink });
    const shouldCreatePaymentLink = plan.checkout;
    if (shouldCreatePaymentLink && !guestEmail) {
      throw new Error("Email obligatoire pour envoyer un lien de paiement Stripe.");
    }
    const initialStatus = plan.status;
    const now = new Date().toISOString();

    const { data: booking, error } = await supabase
      .from("booking_requests")
      .insert([{
        customer_id: customer?.id || null,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        communication_language: normalizeGuestLanguage(body.communicationLanguage),
        start_date: startDate,
        end_date: endDate,
        nights,
        ...(bookingKind === "site" ? {
          ...financialSnapshot,
        } : {
          estimated_total: 0, owner_price: 0, gross_amount: 0, deposit_amount: 0, balance_amount: 0,
        }),
        amount_paid: shouldCreatePaymentLink ? 0 : amountPaid,
        source,
        admin_payment_method: paymentMethod,
        admin_email_notifications_enabled: notificationsEnabled,
        status: initialStatus,
        payment_status: plan.paymentStatus,
        deposit_status: shouldCreatePaymentLink && financialSnapshot.payment_preference !== "full" ? "à payer" : plan.depositStatus,
        balance_status: shouldCreatePaymentLink ? (financialSnapshot.payment_preference === "full" ? "à payer" : "en attente") : plan.balanceStatus,
        adults_count: Number(body.adults || 0) || null,
        children_count: Number(body.children || 0) || null,
        baby_bed_needed: Boolean(body.babyBedNeeded),
        arrival_time: cleanText(body.arrivalTime),
        // Le champ message est réservé aux textes réellement rédigés par le client.
        // Les consignes propriétaire/ménage restent dans housekeeping_notes.
        message: clientMessage,
        internal_notes: internalNotes,
        housekeeping_notes: housekeepingNotes,
        payment_link: null,
        acceptance_expires_at: acceptanceExpiresAt,
        accepted_at: shouldCreatePaymentLink ? now : null,
        confirmed_at: initialStatus === "confirmed" ? now : null,
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
      const checkout = await createCheckoutForBooking({ booking });
      paymentLink = checkout.session.url;
      stripeSessionId = checkout.session.id;
      paymentType = checkout.paymentType;
      paymentAmount = checkout.amountToPay;

      const { error: updateError } = await supabase.from("booking_requests").update({
        payment_link: paymentLink,
        stripe_checkout_session_id: stripeSessionId,
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
        // Do not send owner-only internal notes to the guest.
        message: null,
      });

      await logBookingEvent({
        bookingId: booking.id,
        eventType: "admin_booking_payment_link_sent",
        label: paymentType === "full" ? "Lien paiement total envoyé" : "Lien acompte envoyé",
        message: `Lien Stripe envoyé pour ${formatMoney(paymentAmount)}.`,
        metadata: { source: "calendar_admin", bookingKind, contractTotal: total, paymentType, paymentAmount, stripeSessionId },
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
      metadata: { source: "calendar_admin", bookingKind, contractTotal: total, amountPaid },
    });

    let emailWarning = null;
    if (notificationsEnabled && (bookingKind === "personal" || paymentMethod === "cash")) {
      try {
        await sendAdminBookingInformationEmail({ booking, bookingKind, paymentMethod });
      } catch (emailError) {
        emailWarning = "Réservation créée, mais l'email de confirmation n'a pas été envoyé : " + emailError.message;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ success: true, booking, emailWarning }) };
  } catch (error) {
    console.error("Erreur create-personal-booking :", error);
    if (isBookingDateConflictError(error)) {
      return { statusCode: 409, body: JSON.stringify({ code: "DATE_CONFLICT", error: DATE_CONFLICT_MESSAGE }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
