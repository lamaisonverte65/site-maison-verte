import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { createLatestBackupDownload } from "./_lib/pcloud-backup-download.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  const token = process.env.PCLOUD_TOKEN;
  if (!token) {
    console.error("Téléchargement sauvegarde indisponible : PCLOUD_TOKEN absent.");
    return json(500, { error: "Téléchargement de sauvegarde indisponible." });
  }

  try {
    return json(200, await createLatestBackupDownload({ token }));
  } catch {
    console.error("Impossible de préparer le téléchargement de la sauvegarde pCloud.");
    return json(502, { error: "Impossible de préparer la dernière sauvegarde." });
  }
}
