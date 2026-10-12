import { supabase } from "../supabaseClient";

export async function requestLatestBackupDownload() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Session admin manquante.");

  const response = await fetch("/.netlify/functions/admin-download-latest-backup", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Impossible de préparer la dernière sauvegarde.");
  if (!/^https:\/\//i.test(String(payload.downloadUrl || ""))) {
    throw new Error("Lien de téléchargement invalide.");
  }
  return payload;
}
