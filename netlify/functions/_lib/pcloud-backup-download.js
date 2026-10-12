const PCLOUD_API_BASE = "https://eapi.pcloud.com";
export const PCLOUD_QUICK_TIMEOUT_MS = 5_000;
export const PCLOUD_ZIP_TIMEOUT_MS = 45_000;
export const LATEST_BACKUP_POINTER_PATH = "/La Maison Verte/backup-download/latest.json";

const ALLOWED_TIERS = new Set(["daily", "weekly", "monthly", "yearly", "manual", "baseline"]);
const BACKUP_ID_RE = /^\d{4}-\d{2}-\d{2}_\d{6}Z$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PCLOUD_HOST_RE = /^(?:[a-z0-9-]+\.)*pcloud\.com$/i;

export class PcloudBackupDownloadError extends Error {
  constructor(message = "Erreur pCloud.") {
    super(message);
    this.name = "PcloudBackupDownloadError";
  }
}

export function extractPcloudAuthToken(rawToken) {
  const value = String(rawToken ?? "").trim();
  if (!value) throw new PcloudBackupDownloadError("Jeton pCloud manquant.");
  if (!value.startsWith("{")) return value;

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PcloudBackupDownloadError("Jeton pCloud invalide.");
  }
  const accessToken = String(parsed?.access_token ?? "").trim();
  if (!accessToken) throw new PcloudBackupDownloadError("Jeton pCloud invalide.");
  return accessToken;
}

export function validateLatestPointer(pointer) {
  const backupId = pointer?.backup_id;
  const tier = pointer?.tier;
  const completedAt = pointer?.completed_at_utc;
  const folderId = String(pointer?.folder_id ?? "");

  if (
    !BACKUP_ID_RE.test(String(backupId || ""))
    || !ALLOWED_TIERS.has(tier)
    || !ISO_UTC_RE.test(String(completedAt || ""))
    || !/^\d+$/.test(folderId)
    || folderId === "0"
  ) {
    throw new PcloudBackupDownloadError("Pointeur de sauvegarde pCloud invalide.");
  }

  return { backupId, tier, completedAt, folderId };
}

export function buildPcloudDownloadUrl({ hosts, path }) {
  const host = Array.isArray(hosts) ? String(hosts[0] || "") : "";
  const normalizedPath = String(path || "");
  if (!PCLOUD_HOST_RE.test(host) || !normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
    throw new PcloudBackupDownloadError("Lien de téléchargement pCloud invalide.");
  }
  return `https://${host}${normalizedPath}`;
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = PCLOUD_QUICK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch {
    throw new PcloudBackupDownloadError("Appel pCloud impossible.");
  } finally {
    clearTimeout(timer);
  }
}

async function callPcloudJson(method, params, token, fetchImpl, timeoutMs = PCLOUD_QUICK_TIMEOUT_MS) {
  const body = new URLSearchParams({ auth: token, ...params });
  const response = await fetchWithTimeout(fetchImpl, `${PCLOUD_API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  }, timeoutMs);
  if (!response.ok) throw new PcloudBackupDownloadError("Réponse pCloud invalide.");

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new PcloudBackupDownloadError("Réponse pCloud illisible.");
  }
  if (payload?.result !== 0) throw new PcloudBackupDownloadError("Opération pCloud refusée.");
  return payload;
}

export async function createLatestBackupDownload({ token, fetchImpl = fetch }) {
  const authToken = extractPcloudAuthToken(token);

  const pointerLink = await callPcloudJson("getfilelink", {
    path: LATEST_BACKUP_POINTER_PATH,
    forcedownload: "1",
  }, authToken, fetchImpl);
  const pointerUrl = buildPcloudDownloadUrl(pointerLink);

  const pointerResponse = await fetchWithTimeout(fetchImpl, pointerUrl, {
    method: "GET",
    cache: "no-store",
  });
  if (!pointerResponse.ok) throw new PcloudBackupDownloadError("Pointeur pCloud indisponible.");

  let rawPointer;
  try {
    rawPointer = JSON.parse(await pointerResponse.text());
  } catch {
    throw new PcloudBackupDownloadError("Pointeur pCloud illisible.");
  }
  const pointer = validateLatestPointer(rawPointer);
  const filename = `La-Maison-Verte-Supabase-${pointer.backupId}-encrypted.zip`;

  const zipLink = await callPcloudJson("getziplink", {
    folderid: pointer.folderId,
    forcedownload: "1",
    filename,
  }, authToken, fetchImpl, PCLOUD_ZIP_TIMEOUT_MS);
  const downloadUrl = buildPcloudDownloadUrl(zipLink);

  return {
    downloadUrl,
    filename,
    backupId: pointer.backupId,
    completedAt: pointer.completedAt,
  };
}
