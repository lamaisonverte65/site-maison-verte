import { createClient } from "@supabase/supabase-js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { canMutateReservationData } from "./_lib/business-mutation-policy.js";
import { DATE_CONFLICT_MESSAGE, isBookingDateConflictError } from "./_lib/public-booking-request.js";

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

function editableText(body, field, fallback = null) {
  return fieldProvided(body, field) ? cleanText(body[field]) : fallback;
}

function normalizeBookingKind(value) {
  const kind = String(value || "").toLowerCase();
  if (["site", "client", "admin_client"].includes(kind)) return "site";
  if (kind === "booking") return "booking";
  if (kind === "airbnb") return "airbnb";
  return "personal";
}

function normalizeStatus(value, fallback = null) {
  const status = String(value || "").toLowerCase().trim();
  const allowed = ["pending", "accepted", "deposit_paid", "paid", "fully_paid", "confirmed", "cancelled", "refused", "expired"];
  return allowed.includes(status) ? status : fallback;
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

function splitDisplayName(displayName) {
  const clean = cleanText(displayName) || "Réservation personnelle";
  return { firstName: clean, lastName: "" };
}

function nightsBetween(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 0);
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

  if (!firstName || !lastName) throw new Error("Prénom et nom obligatoires pour créer ou mettre à jour la fiche client.");

  let existingCustomer = null;

  if (body.customerId) {
    const { data, error } = await supabase.from("customers").select("*").eq("id", body.customerId).maybeSingle();
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
      .update({ ...basePayload, first_stay: existingCustomer.first_stay || startDate })
      .eq("id", existingCustomer.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert([{ ...basePayload, first_stay: startDate, booking_count: 0, booking_request_count: 1, customer_status: "prospect" }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function logBookingEvent({ bookingId, userEmail, metadata = {} }) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: "booking_updated_from_calendar",
    label: "Réservation modifiée",
    message: "Réservation modifiée depuis le calendrier admin.",
    actor: userEmail || "admin",
    metadata,
  }]);
  if (error) console.error("Erreur historique booking_events:", error.message);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const admin = await authorizeAdminRequest(event, supabase);
    if (!admin.ok) return authorizationResponse(admin);
    admin.user = admin.authUser;
    admin.canUseAdmin = canMutateReservationData(admin);
    if (!admin.canUseAdmin) return { statusCode: 403, body: JSON.stringify({ error: "Droit propriétaire requis." }) };

    const body = JSON.parse(event.body || "{}");
    const bookingId = body.bookingId;
    const startDate = String(body.startDate || "").slice(0, 10);
    const endDate = String(body.endDate || "").slice(0, 10);

    if (!bookingId) return { statusCode: 400, body: JSON.stringify({ error: "bookingId manquant." }) };

    const { data: existingBooking, error: fetchError } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingBooking) return { statusCode: 404, body: JSON.stringify({ error: "Réservation introuvable." }) };

    if (!startDate || !endDate || endDate <= startDate) return { statusCode: 400, body: JSON.stringify({ error: "Période invalide." }) };

    const bookingKind = normalizeBookingKind(body.bookingKind);
    const total = bookingKind === "site" ? Math.max(Number(body.total || 0), 0) : 0;
    const customer = await findOrCreateCustomer(body, startDate, endDate);

    let guestFirstName = cleanText(body.firstName);
    let guestLastName = cleanText(body.lastName);
    let guestEmail = cleanText(body.email);
    let guestPhone = cleanText(body.phone);

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
      guestEmail = null;
      guestPhone = cleanText(body.phone);
    }

    if (!guestFirstName && bookingKind !== "personal") throw new Error("Nom client manquant.");

    const clientMessage = editableText(body, "clientMessage", existingBooking.message);
    const internalNotes = editableText(body, "internalNotes", existingBooking.owner_message);
    const housekeepingNotes = editableText(body, "housekeepingNotes", existingBooking.housekeeping_notes);
    const nights = nightsBetween(startDate, endDate);
    const now = new Date().toISOString();
    const source = getBookingSource(bookingKind);
    const contractVersion = getBookingContractVersion(bookingKind);
    const requestedStatus = normalizeStatus(body.status, existingBooking.status || "pending");

    const updatePayload = {
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
      source,
      contract_version: contractVersion,
      status: requestedStatus,
      adults_count: Number(body.adults || 0) || null,
      children_count: Number(body.children || 0) || null,
      baby_bed_needed: Boolean(body.babyBedNeeded),
      arrival_time: cleanText(body.arrivalTime),
      message: clientMessage,
      owner_message: internalNotes,
      housekeeping_notes: housekeepingNotes,
      updated_at: now,
    };

    if (bookingKind !== "site") {
      updatePayload.estimated_total = 0;
      updatePayload.owner_price = 0;
      updatePayload.gross_amount = 0;
      updatePayload.amount_paid = 0;
      updatePayload.payment_status = "not_required";
      updatePayload.deposit_amount = 0;
      updatePayload.balance_amount = 0;
      updatePayload.deposit_status = "non applicable";
      updatePayload.balance_status = "non applicable";
      updatePayload.payment_link = null;
      updatePayload.stripe_checkout_session_id = null;
      updatePayload.status = requestedStatus || "confirmed";
      updatePayload.confirmed_at = updatePayload.status === "confirmed" ? (existingBooking.confirmed_at || now) : existingBooking.confirmed_at;
    }

    if (bookingKind === "site" && requestedStatus === "confirmed" && !existingBooking.confirmed_at) {
      updatePayload.confirmed_at = now;
    }

    const { data: booking, error } = await supabase
      .from("booking_requests")
      .update(updatePayload)
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;

    await logBookingEvent({
      bookingId,
      userEmail: admin.user?.email,
      metadata: { source: "calendar_admin", bookingKind, startDate, endDate, total },
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, booking }) };
  } catch (error) {
    console.error("Erreur update-booking-request :", error);
    if (isBookingDateConflictError(error)) {
      return { statusCode: 409, body: JSON.stringify({ code: "DATE_CONFLICT", error: DATE_CONFLICT_MESSAGE }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
