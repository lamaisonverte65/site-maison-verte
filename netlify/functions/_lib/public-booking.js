import { createHash } from "node:crypto";
import { escapeHtml } from "./html.js";

const allowedFields = new Set([
  "guestFirstName", "guestLastName", "guestEmail", "guestPhone", "guestAddress", "guestPostalCode", "guestCity", "guestCountry", "adultsCount", "childrenCount",
  "childrenAges", "babyBedNeeded", "marketingConsent", "guestMessage", "startDate", "endDate",
  "nights", "accommodationTotal", "promotionCode", "cleaningOption", "cleaningObligationsAccepted", "paymentPreference", "contractAccepted", "website",
]);
const fail = (error) => ({ ok: false, statusCode: 400, error });
const clean = (value) => String(value ?? "").trim();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const CLEANING_OBLIGATIONS_VERSION = "2026-09-24-v1";

function validDate(value) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const normalizeFingerprintText = (value) => String(value ?? "")
  .normalize("NFKC")
  .trim()
  .toLocaleLowerCase("fr-FR")
  .replace(/\s+/g, " ");

export function canonicalizePhoneForBookingDeduplication(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const digits = text.replace(/\D/g, "");
  let frenchNationalNumber = null;

  if (digits.length === 10 && digits.startsWith("0")) {
    frenchNationalNumber = digits.slice(1);
  } else if (text.startsWith("+") && digits.startsWith("33")) {
    frenchNationalNumber = digits.slice(2);
  } else if (digits.startsWith("0033")) {
    frenchNationalNumber = digits.slice(4);
  }

  if (frenchNationalNumber?.length === 10 && frenchNationalNumber.startsWith("0")) {
    frenchNationalNumber = frenchNationalNumber.slice(1);
  }
  if (frenchNationalNumber?.length === 9) return `+33${frenchNationalNumber}`;

  if (text.startsWith("+")) return digits ? `+${digits}` : "";
  if (digits.startsWith("00") && digits.length > 2) return `+${digits.slice(2)}`;
  return digits;
}

export function createPublicBookingFingerprint(booking = {}) {
  const significantData = [
    normalizeFingerprintText(booking.guest_first_name),
    normalizeFingerprintText(booking.guest_last_name),
    normalizeFingerprintText(booking.guest_email),
    canonicalizePhoneForBookingDeduplication(booking.guest_phone),
    Number(booking.adults_count),
    Number(booking.children_count || 0),
    normalizeFingerprintText(booking.children_ages),
    booking.baby_bed_needed === true,
    booking.marketing_consent === true,
    normalizeFingerprintText(booking.message),
    String(booking.start_date || ""),
    String(booking.end_date || ""),
    Number(booking.nights),
    Number(booking.estimated_total),
    Number(booking.accommodation_gross ?? 0),
    String(booking.promotion_code || ""),
    Number(booking.promotion_discount_amount ?? 0),
    Number(booking.accommodation_net ?? 0),
    Number(booking.tourist_tax_amount ?? 0),
    booking.cleaning_option === true,
    Number(booking.cleaning_fee || 0),
    String(booking.cleaning_obligations_version || ""),
    String(booking.payment_preference || "deposit"),
    booking.contract_accepted === true,
    String(booking.contract_version || ""),
  ];
  return createHash("sha256").update(JSON.stringify(significantData), "utf8").digest("hex");
}

export function isDuplicatePublicBooking(candidates, incomingBooking, { now = new Date(), windowMs = 5 * 60 * 1000 } = {}) {
  const incomingFingerprint = createPublicBookingFingerprint(incomingBooking);
  return (candidates || []).some((candidate) => {
    const createdAt = new Date(candidate?.created_at || "");
    const age = now.getTime() - createdAt.getTime();
    return !Number.isNaN(createdAt.getTime())
      && age >= 0
      && age <= windowMs
      && createPublicBookingFingerprint(candidate) === incomingFingerprint;
  });
}

export async function claimPublicBookingSubmission(repository, incomingBooking) {
  return repository.claimFingerprint(createPublicBookingFingerprint(incomingBooking));
}

export function validatePublicBookingPayload(input = {}, { cleaningFee = 0 } = {}) {
  const unknown = Object.keys(input).find((field) => !allowedFields.has(field));
  if (unknown) return fail(`Champ inattendu : ${unknown}.`);
  if (clean(input.website)) return fail("Demande automatisée refusée.");

  const firstName = clean(input.guestFirstName);
  const lastName = clean(input.guestLastName);
  const email = clean(input.guestEmail).toLowerCase();
  const phone = clean(input.guestPhone);
  const address = clean(input.guestAddress);
  const postalCode = clean(input.guestPostalCode);
  const city = clean(input.guestCity);
  const country = clean(input.guestCountry);
  const message = clean(input.guestMessage);
  const childrenAges = clean(input.childrenAges);
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) return fail("Nom ou prénom invalide.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Adresse email invalide.");
  if (!phone || phone.length > 32 || !/^[+\d][\d\s().-]{5,31}$/.test(phone)) return fail("Numéro de téléphone invalide.");
  if (!address || address.length > 200) return fail("Adresse postale invalide.");
  if (!postalCode || postalCode.length > 20) return fail("Code postal invalide.");
  if (!city || city.length > 100) return fail("Ville invalide.");
  if (!country || country.length > 100) return fail("Pays invalide.");
  if (message.length > 1500 || childrenAges.length > 120) return fail("Un champ texte dépasse la taille autorisée.");

  const adults = Number(input.adultsCount);
  const children = Number(input.childrenCount || 0);
  if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 1 || children < 0 || adults + children > 4) return fail("Composition des voyageurs invalide.");
  if (children > 0 && !childrenAges) return fail("Âge des enfants requis.");

  const startDate = clean(input.startDate);
  const endDate = clean(input.endDate);
  if (!validDate(startDate) || !validDate(endDate) || endDate <= startDate) return fail("Dates de séjour invalides.");
  const computedNights = Math.round((new Date(`${endDate}T12:00:00Z`) - new Date(`${startDate}T12:00:00Z`)) / 86400000);
  if (computedNights < 1 || computedNights > 60 || Number(input.nights) !== computedNights) return fail("Nombre de nuits invalide.");

  const accommodationTotal = Number(input.accommodationTotal);
  if (!Number.isFinite(accommodationTotal) || accommodationTotal <= 0 || accommodationTotal > 100000) return fail("Total hébergement invalide.");
  if (typeof input.cleaningOption !== "boolean") return fail("Option ménage invalide.");
  if (input.paymentPreference !== undefined && !new Set(["deposit", "full"]).has(input.paymentPreference)) return fail("Préférence de paiement invalide.");

  const authoritativeCleaningFee = Number(cleaningFee);
  if (!Number.isInteger(authoritativeCleaningFee) || authoritativeCleaningFee < 0 || authoritativeCleaningFee > 100000) {
    throw new Error("Configuration du forfait ménage invalide.");
  }

  if (!input.cleaningOption && input.cleaningObligationsAccepted !== true) {
    return fail("Les obligations de ménage doivent être acceptées lorsque le forfait ménage est refusé.");
  }

  const appliedCleaningFee = input.cleaningOption ? authoritativeCleaningFee : 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const arrival = new Date(`${startDate}T00:00:00.000Z`);
  const daysBeforeArrival = Math.ceil((arrival.getTime() - today.getTime()) / 86400000);
  const requestedPaymentPreference = input.paymentPreference === "full" ? "full" : "deposit";
  const paymentPreference = daysBeforeArrival <= 30 ? "full" : requestedPaymentPreference;
  const total = accommodationTotal + appliedCleaningFee;
  if (!Number.isFinite(total) || total <= 0 || total > 100000) return fail("Total invalide.");
  if (input.contractAccepted !== true) return fail("Le contrat doit être accepté.");
  if (typeof input.babyBedNeeded !== "boolean" || typeof input.marketingConsent !== "boolean") return fail("Valeur booléenne invalide.");

  const acceptedAt = new Date().toISOString();
  const emailModel = {
    firstName, lastName, email, phone, address, postalCode, city, country, adults, children, childrenAges,
    babyBedNeeded: input.babyBedNeeded, message, startDate, endDate,
    nights: computedNights, accommodationTotal, cleaningOption: input.cleaningOption,
    cleaningFee: authoritativeCleaningFee, total, paymentPreference,
  };
  return {
    ok: true,
    booking: {
      status: "pending", guest_first_name: firstName, guest_last_name: lastName,
      guest_email: email, guest_phone: phone, guest_address: address, guest_postal_code: postalCode,
      guest_city: city, guest_country: country, adults_count: adults, children_count: children,
      children_ages: childrenAges || null, baby_bed_needed: input.babyBedNeeded,
      marketing_consent: input.marketingConsent,
      marketing_consent_at: input.marketingConsent ? acceptedAt : null,
      start_date: startDate, end_date: endDate, nights: computedNights, estimated_total: total,
      cleaning_option: input.cleaningOption, cleaning_fee: authoritativeCleaningFee,
      payment_preference: paymentPreference,
      cleaning_obligations_accepted_at: input.cleaningOption ? null : acceptedAt,
      cleaning_obligations_version: input.cleaningOption ? null : CLEANING_OBLIGATIONS_VERSION,
      message: message || null, contract_accepted: true, contract_accepted_at: acceptedAt,
      contract_version: "v1.2", contract_url: "https://lamaisonverte65.fr/documents/contrat-location.pdf",
    },
    emailModel,
  };
}

export function buildPublicBookingEmails(model, { ownerEmail }) {
  const firstName = escapeHtml(model.firstName);
  const lastName = escapeHtml(model.lastName);
  const email = escapeHtml(model.email);
  const phone = escapeHtml(model.phone);
  const ages = escapeHtml(model.childrenAges);
  const message = escapeHtml(model.message).replace(/\r?\n/g, "<br />");
  const travelers = [
    `${model.adults} adulte${model.adults > 1 ? "s" : ""}`,
    model.children ? `${model.children} enfant${model.children > 1 ? "s" : ""}` : null,
    ages ? `âges : ${ages}` : null,
    model.babyBedNeeded ? "lit bébé à prévoir" : null,
  ].filter(Boolean).join(" · ");
  const cleaning = model.cleaningOption
    ? `Oui (${model.cleaningFee.toFixed(2)} €)`
    : "Non";
  const rawDepositRate = Number(model.depositRate);
  const depositPercent = Number.isFinite(rawDepositRate) ? Math.round(rawDepositRate * 100) : null;
  const paymentPreference = model.paymentPreference === "full"
    ? "Paiement intégral"
    : depositPercent === null ? "Acompte puis solde à J-30" : `Acompte de ${depositPercent} % puis solde à J-30`;
  const promotionDetails = model.promotionCode && Number(model.promotionDiscountAmount || 0) > 0
    ? `<strong>Hébergement :</strong> ${Number(model.accommodationGross).toFixed(2)} €<br /><strong>Remise ${escapeHtml(model.promotionCode)} :</strong> -${Number(model.promotionDiscountAmount).toFixed(2)} €<br /><strong>Hébergement après remise :</strong> ${model.accommodationTotal.toFixed(2)} €<br />`
    : `<strong>Hébergement :</strong> ${model.accommodationTotal.toFixed(2)} €<br />`;
  const summary = `<p><strong>Arrivée :</strong> ${escapeHtml(model.startDate)}<br /><strong>Départ :</strong> ${escapeHtml(model.endDate)}<br /><strong>Voyageurs :</strong> ${travelers}<br /><strong>Nombre de nuits :</strong> ${model.nights}<br />${promotionDetails}<strong>Forfait ménage :</strong> ${cleaning}<br /><strong>Taxe de séjour :</strong> ${Number(model.touristTaxAmount || 0).toFixed(2)} €<br /><strong>Total :</strong> ${model.total.toFixed(2)} €<br /><strong>Mode de paiement souhaité :</strong> ${paymentPreference}</p>`;
  return {
    owner: {
      to: ownerEmail,
      subject: "Nouvelle demande de réservation",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>Nouvelle demande de réservation</h2><p><strong>Nom :</strong> ${firstName} ${lastName}<br /><strong>Email :</strong> ${email}<br /><strong>Téléphone :</strong> ${phone}</p>${summary}${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}</div>`,
    },
    guest: {
      to: model.email,
      subject: "Votre demande pour La Maison Verte à Arreau",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><p>Bonjour ${firstName},</p><p>Merci pour votre demande de réservation à La Maison Verte.</p><p>Nous avons bien reçu votre demande pour votre séjour à Arreau du <strong>${escapeHtml(model.startDate)}</strong> au <strong>${escapeHtml(model.endDate)}</strong>.</p><p><strong>Récapitulatif de votre demande</strong></p>${summary}<p><strong>Votre réservation n'est pas encore définitive à ce stade, mais les dates sont bloquées.</strong></p><p>Après acceptation de votre demande, vous recevrez les informations nécessaires pour confirmer votre réservation. Un lien de paiement Stripe vous sera envoyé. Ce lien sera valable pendant <strong>24 h</strong> ; passé ce délai, en l'absence de paiement, la période sera à nouveau disponible.</p><p>Au plaisir de vous accueillir,<br /><strong>Raphaël &amp; Emmanuelle</strong><br /><a href="tel:+33695938315">06 95 93 83 15</a><br /><strong>La Maison Verte — Arreau</strong></p></div>`,
    },
  };
}
