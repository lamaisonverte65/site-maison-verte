import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function toNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function toBoolean(value) {
  return value === true || value === "true" || value === "oui" || value === "yes" || value === 1;
}

function nightsBetween(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 0);
}

function buildCustomerNotes(existingCustomer, item, email, phone) {
  const previousNotes = cleanText(existingCustomer?.notes) || "";
  const additions = [];

  if (email && existingCustomer?.email && email !== existingCustomer.email) {
    additions.push(`Ancien email conservé : ${existingCustomer.email}`);
  }

  if (phone && existingCustomer?.phone && phone !== existingCustomer.phone) {
    additions.push(`Ancien téléphone conservé : ${existingCustomer.phone}`);
  }

  const itemNotes = cleanText(item.notes);
  if (itemNotes && !previousNotes.includes(itemNotes)) additions.push(itemNotes);

  if (!additions.length) return previousNotes || null;

  const stamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  const updateNote = `[${stamp}] Mise à jour depuis import externe : ${additions.join(" ; ")}`;
  return [previousNotes, updateNote].filter(Boolean).join("\n");
}

async function findOrCreateCustomer(item, source, startDate, endDate) {
  const firstName = cleanText(item.firstName);
  const lastName = cleanText(item.lastName);
  const email = cleanText(item.email);
  const phone = cleanText(item.phone);
  const customerId = cleanText(item.customerId);

  let existingCustomer = null;

  if (customerId) {
    const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
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

  if (existingCustomer) {
    const { data, error } = await supabase
      .from("customers")
      .update({
        first_name: firstName || existingCustomer.first_name,
        last_name: lastName || existingCustomer.last_name,
        email: email || existingCustomer.email,
        phone: phone || existingCustomer.phone,
        source: existingCustomer.source || source,
        notes: buildCustomerNotes(existingCustomer, item, email, phone),
        last_request_at: new Date().toISOString(),
        last_stay: endDate,
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
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      source,
      notes: cleanText(item.notes),
      first_stay: startDate,
      last_stay: endDate,
      last_request_at: new Date().toISOString(),
      booking_count: 0,
      booking_request_count: 1,
      customer_status: "prospect",
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
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
  if (error) console.error("Erreur log booking_events:", error.message);
}

async function createBookingFromExternalItem(item, context) {
  const startDate = item.startDate;
  const endDate = item.endDate;
  const total = Math.max(toNumber(item.total, 0), 0);
  const amountPaid = Math.max(toNumber(item.amountPaid, 0), 0);
  const isPersonalReservation = item.type === "personal_reservation";
  const source = isPersonalReservation ? "admin_client" : `${context.source}_import`;
  const sourceLabel = isPersonalReservation ? "réservation perso / directe" : `réservation ${context.source}`;
  const nights = nightsBetween(startDate, endDate);
  const customer = await findOrCreateCustomer(item, source, startDate, endDate);
  const now = new Date().toISOString();

  const { data: booking, error } = await supabase
    .from("booking_requests")
    .insert([{
      customer_id: customer?.id || null,
      guest_first_name: customer?.first_name || cleanText(item.firstName),
      guest_last_name: customer?.last_name || cleanText(item.lastName),
      guest_email: customer?.email || cleanText(item.email),
      guest_phone: customer?.phone || cleanText(item.phone),
      start_date: startDate,
      end_date: endDate,
      nights,
      estimated_total: total,
      owner_price: total,
      gross_amount: total,
      amount_paid: amountPaid,
      source,
      status: "confirmed",
      payment_status: amountPaid > 0 ? "manual_paid" : (isPersonalReservation ? "manual_pending" : "external_platform"),
      deposit_amount: 0,
      balance_amount: Math.max(total - amountPaid, 0),
      deposit_status: "non applicable",
      balance_status: "non applicable",
      adults_count: cleanText(item.adults),
      children_count: cleanText(item.children),
      baby_bed_needed: toBoolean(item.babyBedNeeded),
      arrival_time: cleanText(item.arrivalTime),
      // Le champ message est réservé aux textes rédigés par le client.
      // Les infos saisies lors de l'import externe restent en notes admin.
      message: null,
      owner_message: cleanText(item.notes) || `${sourceLabel} créée depuis un import calendrier externe.`,
      housekeeping_notes: cleanText(item.notes),
      payment_link: null,
      accepted_at: now,
      confirmed_at: now,
      contract_accepted: false,
      contract_status: "not_sent",
      contract_version: source,
      updated_at: now,
    }])
    .select()
    .single();

  if (error) throw error;

  await logBookingEvent({
    bookingId: booking.id,
    eventType: isPersonalReservation ? "external_calendar_personal_booking_created" : "external_calendar_booking_created",
    label: isPersonalReservation ? "Réservation perso/directe créée depuis import externe" : "Réservation créée depuis import externe",
    message: `Créée depuis le bloc ${context.source} ${context.uid || ""}.`,
    metadata: { external_uid: context.uid, source: context.source, action: context.action, customer_id: customer?.id || null },
  });

  return booking;
}

async function createBlockFromExternalItem(item, context) {
  const { data, error } = await supabase
    .from("calendar_blocks")
    .insert([{
      title: cleanText(item.title) || "Blocage importé",
      start_date: item.startDate,
      end_date: item.endDate,
      notes: cleanText(item.notes) || `Créé depuis le bloc ${context.source} ${context.uid || ""}.`,
      source: `${context.source}_import_manual`,
      status: "blocked",
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const admin = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.manageReservations, ADMIN_PERMISSIONS.manageCalendar] });
    if (!admin.ok) return authorizationResponse(admin);

    const body = JSON.parse(event.body || "{}");
    const action = "manual_periods";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!body.uid) return json(400, { error: "UID import externe manquant." });
    if (!body.source) return json(400, { error: "Source import externe manquante." });
    if (!items.length) return json(400, { error: "Aucune période à créer." });

    const context = { uid: body.uid, source: body.source, action };
    const createdBookings = [];
    const createdBlocks = [];

    for (const item of items) {
      if (!item.startDate || !item.endDate || item.endDate <= item.startDate) {
        throw new Error("Période invalide dans la création manuelle depuis l’import externe.");
      }

      if (item.type === "block") {
        const block = await createBlockFromExternalItem(item, context);
        createdBlocks.push(block);
      } else {
        const booking = await createBookingFromExternalItem(item, context);
        createdBookings.push(booking);
      }
    }

    const payload = {
      original: {
        source: body.source,
        uid: body.uid,
        title: body.title || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
      },
      items,
      created_booking_ids: createdBookings.map((booking) => booking.id),
      created_block_ids: createdBlocks.map((block) => block.id),
    };

    const { data: savedAction, error: actionError } = await supabase
      .from("external_calendar_actions")
      .upsert({
        uid: body.uid,
        source: body.source,
        title: body.title || null,
        start_date: body.startDate || null,
        end_date: body.endDate || null,
        action,
        status: "applied",
        payload,
        created_booking_ids: payload.created_booking_ids,
        created_block_ids: payload.created_block_ids,
        is_active: true,
        alert_status: "ok",
        updated_at: new Date().toISOString(),
        created_by_email: admin.user.email,
      }, { onConflict: "uid" })
      .select()
      .single();

    if (actionError) throw actionError;

    return json(200, {
      success: true,
      action: savedAction,
      bookings: createdBookings,
      blocks: createdBlocks,
    });
  } catch (error) {
    console.error("Erreur apply-external-calendar-action:", error);
    return json(500, { error: error.message });
  }
}
