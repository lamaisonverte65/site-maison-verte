import { createHash } from "node:crypto";
import { escapeHtml } from "./html.js";

const allowedFields = new Set([
  "guestFirstName", "guestLastName", "guestEmail", "guestPhone", "adultsCount", "childrenCount",
  "childrenAges", "babyBedNeeded", "marketingConsent", "guestMessage", "startDate", "endDate",
  "nights", "total", "contractAccepted", "website",
]);
const fail = (error) => ({ ok: false, statusCode: 400, error });
const clean = (value) => String(value ?? "").trim();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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

export function validatePublicBookingPayload(input = {}) {
  const unknown = Object.keys(input).find((field) => !allowedFields.has(field));
  if (unknown) return fail(`Champ inattendu : ${unknown}.`);
  if (clean(input.website)) return fail("Demande automatisée refusée.");

  const firstName = clean(input.guestFirstName);
  const lastName = clean(input.guestLastName);
  const email = clean(input.guestEmail).toLowerCase();
  const phone = clean(input.guestPhone);
  const message = clean(input.guestMessage);
  const childrenAges = clean(input.childrenAges);
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) return fail("Nom ou prénom invalide.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Adresse email invalide.");
  if (!phone || phone.length > 32 || !/^[+\d][\d\s().-]{5,31}$/.test(phone)) return fail("Numéro de téléphone invalide.");
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
  const total = Number(input.total);
  if (!Number.isFinite(total) || total <= 0 || total > 100000) return fail("Total estimatif invalide.");
  if (input.contractAccepted !== true) return fail("Le contrat doit être accepté.");
  if (typeof input.babyBedNeeded !== "boolean" || typeof input.marketingConsent !== "boolean") return fail("Valeur booléenne invalide.");

  const emailModel = {
    firstName, lastName, email, phone, adults, children, childrenAges,
    babyBedNeeded: input.babyBedNeeded, message, startDate, endDate,
    nights: computedNights, total,
  };
  return {
    ok: true,
    booking: {
      status: "pending", guest_first_name: firstName, guest_last_name: lastName,
      guest_email: email, guest_phone: phone, adults_count: adults, children_count: children,
      children_ages: childrenAges || null, baby_bed_needed: input.babyBedNeeded,
      marketing_consent: input.marketingConsent,
      marketing_consent_at: input.marketingConsent ? new Date().toISOString() : null,
      start_date: startDate, end_date: endDate, nights: computedNights, estimated_total: total,
      message: message || null, contract_accepted: true, contract_accepted_at: new Date().toISOString(),
      contract_version: "v1.1", contract_url: "https://lamaisonverte65.fr/documents/contrat-location.pdf",
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
  const summary = `<p><strong>Arrivée :</strong> ${escapeHtml(model.startDate)}<br /><strong>Départ :</strong> ${escapeHtml(model.endDate)}<br /><strong>Voyageurs :</strong> ${travelers}<br /><strong>Nombre de nuits :</strong> ${model.nights}<br /><strong>Total estimatif :</strong> ${model.total.toFixed(2)} €</p>`;
  return {
    owner: {
      to: ownerEmail,
      subject: "Nouvelle demande de réservation",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>Nouvelle demande de réservation</h2><p><strong>Nom :</strong> ${firstName} ${lastName}<br /><strong>Email :</strong> ${email}<br /><strong>Téléphone :</strong> ${phone}</p>${summary}${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}</div>`,
    },
    guest: {
      to: model.email,
      subject: "Votre demande de réservation - La Maison Verte",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>Votre demande a bien été reçue</h2><p>Bonjour ${firstName} ${lastName},</p><p>Nous avons bien reçu votre demande de réservation pour La Maison Verte à Arreau.</p>${summary}<p>Votre demande va être étudiée rapidement avant validation définitive.</p></div>`,
    },
  };
}
