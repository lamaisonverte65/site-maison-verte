import { canonicalizePhoneForBookingDeduplication } from "./public-booking.js";

const clean = (value) => String(value ?? "").trim();

function frenchNationalFromCanonical(canonical) {
  const match = /^\+33(\d{9})$/.exec(canonical);
  return match ? `0${match[1]}` : null;
}

export function phoneLookupCandidates(value) {
  const original = clean(value);
  const canonical = canonicalizePhoneForBookingDeduplication(original);
  const values = new Set([original, canonical].filter(Boolean));
  const frenchNational = frenchNationalFromCanonical(canonical);
  if (frenchNational) {
    values.add(frenchNational);
    values.add(frenchNational.replace(/(\d{2})(?=\d)/g, "$1 ").trim());
    values.add(`+33 ${frenchNational.slice(1).replace(/(\d)(?=\d)/, "$1 ").replace(/(\d{2})(?=\d)/g, "$1 ").trim()}`);
    values.add(`0033 ${frenchNational.slice(1).replace(/(\d)(?=\d)/, "$1 ").replace(/(\d{2})(?=\d)/g, "$1 ").trim()}`);
  }
  return [...values];
}

const earlierDate = (a, b) => {
  if (!a) return b || null;
  if (!b) return a || null;
  return String(a).slice(0, 10) <= String(b).slice(0, 10) ? a : b;
};

const laterDate = (a, b) => {
  if (!a) return b || null;
  if (!b) return a || null;
  return String(a).slice(0, 10) >= String(b).slice(0, 10) ? a : b;
};

function customerCreationPayload(contact, { startDate, endDate, now }) {
  return {
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    address: contact.address || null,
    postal_code: contact.postalCode || null,
    city: contact.city || null,
    country: contact.country || null,
    source: "site_contact",
    marketing_consent: false,
    first_stay: startDate,
    last_stay: endDate,
    last_request_at: now,
    booking_count: 0,
    booking_request_count: 0,
    customer_status: "prospect",
  };
}

function customerEnrichmentPayload(existing, contact, { startDate, endDate, now }) {
  const payload = {
    first_stay: earlierDate(existing?.first_stay, startDate),
    last_stay: laterDate(existing?.last_stay, endDate),
    last_request_at: now,
  };
  const fields = [
    ["first_name", contact.firstName],
    ["last_name", contact.lastName],
    ["email", contact.email],
    ["phone", contact.phone],
    ["address", contact.address],
    ["postal_code", contact.postalCode],
    ["city", contact.city],
    ["country", contact.country],
  ];
  for (const [field, value] of fields) {
    if (!clean(existing?.[field]) && clean(value)) payload[field] = clean(value);
  }
  return payload;
}

function contactSnapshotPayload(bookingId, contact, position) {
  return {
    booking_request_id: bookingId,
    position,
    role: "additional",
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    address: contact.address || null,
    postal_code: contact.postalCode || null,
    city: contact.city || null,
    country: contact.country || null,
    link_status: "pending",
  };
}

export async function persistAdditionalBookingContacts(repository, {
  bookingId,
  contacts = [],
  startDate,
  endDate,
  now = new Date().toISOString(),
} = {}) {
  if (!bookingId) throw new Error("Réservation manquante pour les contacts supplémentaires.");
  let linked = 0;
  let conflicts = 0;

  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index];
    const link = await repository.insertContactSnapshot(contactSnapshotPayload(bookingId, contact, index + 1));
    const emailMatch = await repository.findCustomerByEmail(contact.email, contact);
    const phoneMatch = await repository.findCustomerByPhones(phoneLookupCandidates(contact.phone), contact);

    if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
      conflicts += 1;
      await repository.markConflict(link.id, "email_phone_conflict");
      continue;
    }

    const existing = emailMatch || phoneMatch;
    let customer;
    if (existing) {
      customer = await repository.enrichCustomer(
        existing.id,
        customerEnrichmentPayload(existing, contact, { startDate, endDate, now }),
      );
    } else {
      customer = await repository.createCustomer(customerCreationPayload(contact, { startDate, endDate, now }));
    }

    if (!customer?.id) throw new Error("Fiche client supplémentaire invalide.");
    await repository.markLinked(link.id, customer.id);
    linked += 1;
  }

  return { linked, conflicts };
}

export function createSupabaseAdditionalContactRepository(supabase) {
  const singleResult = async (query) => {
    const { data, error } = await query;
    if (error) throw error;
    return data || null;
  };

  return {
    insertContactSnapshot(payload) {
      return singleResult(supabase.from("booking_contacts").insert([payload]).select("id").single());
    },
    findCustomerByEmail(email) {
      if (!email) return null;
      return singleResult(supabase.from("customers").select("*").ilike("email", email).limit(1).maybeSingle());
    },
    findCustomerByPhones(candidates) {
      const values = [...new Set((candidates || []).filter(Boolean))];
      if (!values.length) return null;
      return singleResult(supabase.from("customers").select("*").in("phone", values).limit(1).maybeSingle());
    },
    createCustomer(payload) {
      return singleResult(supabase.from("customers").insert([payload]).select().single());
    },
    enrichCustomer(customerId, payload) {
      return singleResult(supabase.from("customers").update(payload).eq("id", customerId).select().single());
    },
    async markLinked(linkId, customerId) {
      const { error } = await supabase.from("booking_contacts").update({
        customer_id: customerId,
        link_status: "linked",
        link_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", linkId);
      if (error) throw error;
    },
    async markConflict(linkId, reason) {
      const { error } = await supabase.from("booking_contacts").update({
        link_status: "conflict",
        link_error: reason,
        updated_at: new Date().toISOString(),
      }).eq("id", linkId);
      if (error) throw error;
    },
  };
}
