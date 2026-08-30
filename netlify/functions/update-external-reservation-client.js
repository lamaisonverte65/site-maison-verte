import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { canMutateClientData } from "./_lib/business-mutation-policy.js";
import { normalizeEmail } from "./_lib/normalize.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeExternalCustomerPayload(payload = {}) {
  const normalized = { ...payload };
  for (const field of ["uid", "source", "firstName", "lastName", "phone", "startDate", "endDate"]) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) normalized[field] = cleanText(payload[field]);
  }
  normalized.email = normalizeEmail(payload.email) || null;
  return normalized;
}

async function findExistingCustomer({ customerId, email, phone, firstName, lastName }) {
  if (customerId) {
    const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase.from("customers").select("*").eq("email", email).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (data) return data;
  }

  if (phone) {
    const { data, error } = await supabase.from("customers").select("*").eq("phone", phone).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (data) return data;
  }

  if (firstName && lastName) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (data) return data;
  }

  return null;
}

function buildNotes({ notes, arrivalTime, childrenCount, babyBedNeeded }) {
  const lines = [];
  if (notes) lines.push(notes);
  if (arrivalTime) lines.push(`Heure d'arrivée : ${arrivalTime}`);
  if (childrenCount !== null && childrenCount !== undefined && String(childrenCount) !== "") lines.push(`Nombre d'enfants : ${childrenCount}`);
  if (babyBedNeeded === true) lines.push("Lit bébé : oui");
  if (babyBedNeeded === false) lines.push("Lit bébé : non");
  return lines.join("\n") || null;
}

export function buildExternalReservationRow(payload, customer, updatedAt = new Date().toISOString()) {
  return {
    uid: cleanText(payload.uid),
    source: cleanText(payload.source) || "external",
    start_date: cleanText(payload.startDate),
    end_date: cleanText(payload.endDate),
    customer_id: customer.id,
    guest_first_name: cleanText(payload.firstName),
    guest_last_name: cleanText(payload.lastName),
    guest_email: cleanText(payload.email),
    guest_phone: cleanText(payload.phone),
    notes: buildNotes(payload),
    housekeeping_notes: cleanText(payload.notes),
    updated_at: updatedAt,
  };
}

async function upsertExternalReservation(payload, customer) {
  const uid = cleanText(payload.uid);
  if (!uid) return { data: null, warning: "UID réservation externe manquant : client mis à jour, lien externe non créé." };

  const { data, error } = await supabase
    .from("external_reservation_clients")
    .upsert(buildExternalReservationRow(payload, customer), { onConflict: "uid" })
    .select()
    .single();
  if (error) throw error;
  return { data };
}

async function createOrUpdateCustomer(payload) {
  const normalized = normalizeExternalCustomerPayload(payload);
  const firstName = normalized.firstName;
  const lastName = normalized.lastName;
  const email = normalized.email;
  const phone = normalized.phone;
  const source = normalized.source || "external";
  const notes = buildNotes(normalized);

  const existing = await findExistingCustomer({
    customerId: cleanText(payload.customerId),
    email,
    phone,
    firstName,
    lastName,
  });

  if (existing) {
    const updates = {
      first_name: firstName || existing.first_name,
      last_name: lastName || existing.last_name,
      email: email || existing.email,
      phone: phone || existing.phone,
      source: source || existing.source,
      notes: notes || existing.notes,
      last_stay: normalized.endDate || existing.last_stay,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert([{
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      source,
      notes,
      first_stay: normalized.startDate,
      last_stay: normalized.endDate,
      booking_count: 1,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Méthode non autorisée." });
  }

  try {
    const requester = await authorizeAdminRequest(event, supabase);
    if (!requester.ok) return authorizationResponse(requester);
    const canUpdateExternalClient = canMutateClientData(requester);
    if (!canUpdateExternalClient) {
      return json(403, { error: "Droit propriétaire requis." });
    }

    const payload = JSON.parse(event.body || "{}");

    const normalizedPayload = normalizeExternalCustomerPayload(payload);
    const { email, phone, firstName, lastName } = normalizedPayload;

    if (!firstName && !lastName && !email && !phone) {
      return json(400, { error: "Renseigne au moins un nom, un email ou un téléphone." });
    }

    const customer = await createOrUpdateCustomer(normalizedPayload);
    const external = await upsertExternalReservation(normalizedPayload, customer);

    return json(200, {
      ok: true,
      customer,
      externalReservationClient: external.data,
      warning: external.warning || null,
    });
  } catch (error) {
    return json(500, { error: error.message || "Erreur serveur." });
  }
}
