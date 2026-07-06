import { createClient } from "@supabase/supabase-js";

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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getOwnerEmails() {
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function getRequester(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, statusCode: 401, error: "Session admin manquante." };

  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  const email = normalizeEmail(user?.email);
  if (error || !email) return { ok: false, statusCode: 401, error: "Session admin invalide." };

  const ownerEmails = getOwnerEmails();
  const isEnvOwner = ownerEmails.includes(email);

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (adminError && adminError.code !== "PGRST116") {
    return { ok: false, statusCode: 500, error: adminError.message };
  }

  if (!adminUser && isEnvOwner) {
    return { ok: true, authUser: user, adminUser: { email, role: "owner", is_owner: true, is_active: true, permissions: [] } };
  }

  if (!adminUser || adminUser.is_active === false) {
    return { ok: false, statusCode: 403, error: "Compte admin non autorisé ou désactivé." };
  }

  return { ok: true, authUser: user, adminUser: { ...adminUser, is_owner: adminUser.is_owner || isEnvOwner } };
}

function hasPermission(adminUser, permission) {
  if (adminUser?.is_owner || adminUser?.role === "owner" || adminUser?.role === "admin") return true;
  return Array.isArray(adminUser?.permissions) && adminUser.permissions.includes(permission);
}

function canUpdateExternalClient(adminUser) {
  return hasPermission(adminUser, "manage:customers") || hasPermission(adminUser, "manage:reservations") || hasPermission(adminUser, "manage:calendar");
}

function canUpdateHousekeepingUserNotes(adminUser) {
  const role = String(adminUser?.role || "").toLowerCase();
  return canUpdateExternalClient(adminUser) || role === "housekeeping";
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

async function upsertExternalReservation(payload, customer) {
  const uid = cleanText(payload.uid);
  if (!uid) return { data: null, warning: "UID réservation externe manquant : client mis à jour, lien externe non créé." };

  const baseRow = {
    uid,
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
    housekeeping_user_notes: cleanText(payload.housekeepingUserNotes),
    updated_at: new Date().toISOString(),
  };

  const optionalRow = {
    ...baseRow,
    arrival_time: cleanText(payload.arrivalTime),
    children_count: payload.childrenCount === null || payload.childrenCount === undefined || payload.childrenCount === "" ? null : Number(payload.childrenCount),
    baby_bed_needed: typeof payload.babyBedNeeded === "boolean" ? payload.babyBedNeeded : null,
  };

  const { data, error } = await supabase
    .from("external_reservation_clients")
    .upsert(optionalRow, { onConflict: "uid" })
    .select()
    .single();

  if (!error) return { data };

  // Compatibilité avec la table actuelle si les colonnes optionnelles n'existent pas encore.
  if (String(error.message || "").includes("arrival_time") || String(error.message || "").includes("children_count") || String(error.message || "").includes("baby_bed_needed") || String(error.message || "").includes("housekeeping_notes") || String(error.message || "").includes("housekeeping_user_notes")) {
    const legacyRow = { ...baseRow };
    delete legacyRow.housekeeping_notes;
    delete legacyRow.housekeeping_user_notes;

    const retry = await supabase
      .from("external_reservation_clients")
      .upsert(legacyRow, { onConflict: "uid" })
      .select()
      .single();
    if (retry.error) throw retry.error;
    return { data: retry.data, warning: "Colonnes optionnelles absentes : certaines infos restent stockées dans les notes." };
  }

  throw error;
}

async function createOrUpdateCustomer(payload) {
  const firstName = cleanText(payload.firstName);
  const lastName = cleanText(payload.lastName);
  const email = normalizeEmail(payload.email) || null;
  const phone = cleanText(payload.phone);
  const source = cleanText(payload.source) || "external";
  const notes = buildNotes(payload);

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
      last_stay: cleanText(payload.endDate) || existing.last_stay,
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
      first_stay: cleanText(payload.startDate),
      last_stay: cleanText(payload.endDate),
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
    const requester = await getRequester(event);
    if (!requester.ok) return json(requester.statusCode, { error: requester.error });

    const payload = JSON.parse(event.body || "{}");

    if (payload.updateMode === "housekeeping_user_notes") {
      if (!canUpdateHousekeepingUserNotes(requester.adminUser)) {
        return json(403, { error: "Droit ménage insuffisant." });
      }

      const uid = cleanText(payload.uid);
      if (!uid) return json(400, { error: "UID réservation externe manquant." });

      const row = {
        uid,
        source: cleanText(payload.source) || "external",
        start_date: cleanText(payload.startDate),
        end_date: cleanText(payload.endDate),
        housekeeping_user_notes: cleanText(payload.housekeepingUserNotes),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("external_reservation_clients")
        .upsert(row, { onConflict: "uid" })
        .select()
        .single();

      if (error) throw error;
      return json(200, { ok: true, externalReservationClient: data });
    }

    if (!canUpdateExternalClient(requester.adminUser)) {
      return json(403, { error: "Droit modification client/réservation requis." });
    }

    const email = normalizeEmail(payload.email) || null;
    const phone = cleanText(payload.phone);
    const firstName = cleanText(payload.firstName);
    const lastName = cleanText(payload.lastName);

    if (!firstName && !lastName && !email && !phone) {
      return json(400, { error: "Renseigne au moins un nom, un email ou un téléphone." });
    }

    const customer = await createOrUpdateCustomer({ ...payload, email });
    const external = await upsertExternalReservation({ ...payload, email }, customer);

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
