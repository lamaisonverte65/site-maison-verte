import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import {
  filterVisibleExternalOccupations,
  toHousekeepingExternalReservation,
  toHousekeepingReservation,
  validateHousekeepingReadRequest,
} from "./_lib/housekeeping-contract.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const HOUSEKEEPING_BOOKING_FIELDS = [
  "id", "source", "start_date", "end_date",
  "guest_first_name", "guest_last_name", "guest_phone", "guest_email",
  "adults_count", "children_count", "children_ages", "baby_bed_needed",
  "arrival_time",
  "message", "housekeeping_notes",
].join(",");

const EXTERNAL_OCCUPANCY_FIELDS = "id,source,external_uid,start_date,end_date,is_current";
const EXTERNAL_ENRICHMENT_FIELDS = [
  "uid", "source", "guest_first_name", "guest_last_name", "guest_phone", "guest_email",
  "housekeeping_notes",
].join(",");
const EXTERNAL_ACTION_FIELDS = "source,uid,status,is_active,created_booking_ids,created_block_ids";
const NOTE_FIELDS = "id,booking_request_id,external_occupation_id,author_admin_user_id,note,created_at";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});
const externalKey = (source, uid) => `${source || ""}\u0000${uid || ""}`;

async function loadNotesByTarget() {
  const { data, error } = await supabase.from("housekeeping_notes")
    .select(NOTE_FIELDS).order("created_at", { ascending: true });
  if (error) throw error;
  const authorIds = [...new Set((data || []).map((note) => note.author_admin_user_id).filter(Boolean))];
  let authors = [];
  if (authorIds.length) {
    const authorResult = await supabase.from("admin_users").select("id,display_name").in("id", authorIds);
    if (authorResult.error) throw authorResult.error;
    authors = authorResult.data || [];
  }
  const names = new Map(authors.map((author) => [author.id, author.display_name || null]));
  const direct = new Map();
  const external = new Map();
  for (const note of data || []) {
    const enriched = { ...note, author_display_name: names.get(note.author_admin_user_id) || null };
    const map = note.booking_request_id ? direct : external;
    const key = note.booking_request_id || note.external_occupation_id;
    map.set(key, [...(map.get(key) || []), enriched]);
  }
  return { direct, external };
}

async function listReservations() {
  const [bookingsResult, occupationsResult, enrichmentResult, actionsResult, notes] = await Promise.all([
    supabase.from("booking_requests").select(HOUSEKEEPING_BOOKING_FIELDS)
      .not("status", "in", "(refused,expired,cancelled)").order("start_date", { ascending: true }),
    supabase.from("external_occupancies").select(EXTERNAL_OCCUPANCY_FIELDS)
      .eq("is_current", true)
      .order("start_date", { ascending: true }),
    supabase.from("external_reservation_clients").select(EXTERNAL_ENRICHMENT_FIELDS),
    supabase.from("external_calendar_actions").select(EXTERNAL_ACTION_FIELDS),
    loadNotesByTarget(),
  ]);
  if (bookingsResult.error) throw bookingsResult.error;
  if (occupationsResult.error) throw occupationsResult.error;
  if (enrichmentResult.error) throw enrichmentResult.error;
  if (actionsResult.error) throw actionsResult.error;

  const linked = new Map((enrichmentResult.data || []).map((row) => [externalKey(row.source, row.uid), row]));
  const visibleOccupations = filterVisibleExternalOccupations(
    occupationsResult.data || [],
    actionsResult.data || [],
  );
  const reservations = [
    ...(bookingsResult.data || []).map((row) => toHousekeepingReservation(row, notes.direct.get(row.id) || [])),
    ...visibleOccupations.map((row) => {
      const key = externalKey(row.source, row.external_uid);
      return toHousekeepingExternalReservation(row, linked.get(key) || {}, notes.external.get(row.id) || []);
    }),
  ].sort((left, right) => String(left.startDate || "").localeCompare(String(right.startDate || "")));
  return { ok: true, reservations };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });
  try {
    const auth = await authorizeAdminRequest(event, supabase);
    if (!auth.ok) return authorizationResponse(auth);
    const body = JSON.parse(event.body || "{}");
    const policy = validateHousekeepingReadRequest(body);
    if (!policy.ok) return json(policy.statusCode, policy);
    return json(200, await listReservations());
  } catch (error) {
    console.error("Erreur données ménage:", error);
    return json(500, { ok: false, error: "Erreur données ménage." });
  }
}
