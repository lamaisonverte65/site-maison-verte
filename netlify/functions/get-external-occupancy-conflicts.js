import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest } from "./_lib/admin-auth.js";
import { createExternalConflictEndpoint } from "./_lib/external-conflict-endpoint.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CONFLICT_FIELDS = [
  "id",
  "source",
  "external_start_date",
  "external_end_date",
  "local_kind",
  "local_id",
  "local_start_date",
  "local_end_date",
  "occurrence_count",
  "first_detected_at",
  "last_detected_at",
].join(",");

export const handler = createExternalConflictEndpoint({
  authorizeOwner: (event) => authorizeAdminRequest(event, supabase, { ownerOnly: true }),
  async listOpen() {
    const { data, error } = await supabase
      .from("external_occupancy_conflicts")
      .select(CONFLICT_FIELDS)
      .eq("status", "open")
      .order("last_detected_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
});
