import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import {
  createHousekeepingNote,
  listHousekeepingNotes,
} from "./_lib/housekeeping-notes.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const NOTE_FIELDS = "id,booking_request_id,external_occupation_id,author_admin_user_id,note,created_at";
const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const repository = {
  async directTargetExists(id) {
    const { data, error } = await supabase.from("booking_requests")
      .select("id").eq("id", id).maybeSingle();
    if (error) throw error;
    return Boolean(data?.id);
  },
  async findExternalTarget(source, uid) {
    const { data, error } = await supabase.from("external_occupancies")
      .select("id,source,external_uid").eq("source", source).eq("external_uid", uid).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async insertNote(row) {
    const { data, error } = await supabase.from("housekeeping_notes")
      .insert(row).select(NOTE_FIELDS).single();
    if (error) throw error;
    return data;
  },
  async listNotes(target) {
    let query = supabase.from("housekeeping_notes").select(NOTE_FIELDS);
    query = target.kind === "external"
      ? query.eq("external_occupation_id", target.externalOccupationId)
      : query.eq("booking_request_id", target.id);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw error;

    const authorIds = [...new Set((data || []).map((note) => note.author_admin_user_id).filter(Boolean))];
    let authors = [];
    if (authorIds.length) {
      const authorResult = await supabase.from("admin_users")
        .select("id,display_name").in("id", authorIds);
      if (authorResult.error) throw authorResult.error;
      authors = authorResult.data || [];
    }
    const names = new Map(authors.map((author) => [author.id, author.display_name || null]));
    return (data || []).map((note) => ({
      ...note,
      author_display_name: names.get(note.author_admin_user_id) || null,
    }));
  },
};

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });
  try {
    const auth = await authorizeAdminRequest(event, supabase);
    if (!auth.ok) return authorizationResponse(auth);
    const body = JSON.parse(event.body || "{}");
    let result;
    if (body.action === "create") {
      const { action: _action, ...input } = body;
      result = await createHousekeepingNote({ repository, author: auth.profile, input });
    } else if (body.action === "list") {
      const unknown = Object.keys(body).find((key) => !["action", "reservationId"].includes(key));
      result = unknown
        ? { ok: false, statusCode: 400, error: `Attribut non autorisé : ${unknown}.` }
        : await listHousekeepingNotes({ repository, requester: auth.profile, reservationId: body.reservationId });
    } else {
      result = { ok: false, statusCode: 400, error: "Action notes ménage inconnue." };
    }
    return json(result.ok === false ? (result.statusCode || 400) : 200, result);
  } catch (error) {
    console.error("Erreur notes ménage:", error);
    return json(500, { ok: false, error: "Erreur notes ménage." });
  }
}
