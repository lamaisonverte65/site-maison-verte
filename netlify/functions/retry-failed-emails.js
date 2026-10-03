import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { resendEmail } from "./_lib/resend-email.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_MINUTES = [15, 60, 360];

function nowIso() {
  return new Date().toISOString();
}

function isValidPayload(payload) {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    typeof payload.from === "string" &&
    Array.isArray(payload.to) &&
    payload.to.length > 0 &&
    payload.to.every((value) => typeof value === "string" && value.includes("@")) &&
    typeof payload.subject === "string" &&
    typeof payload.html === "string"
  );
}

function nextRetryAt(attempts, now = new Date()) {
  const minutes = BACKOFF_MINUTES[Math.min(Math.max(attempts - 1, 0), BACKOFF_MINUTES.length - 1)];
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

async function equivalentEmailWasSentLater(row) {
  let query = supabase
    .from("email_logs")
    .select("id")
    .eq("email_type", row.email_type)
    .eq("to_email", row.to_email)
    .eq("status", "sent")
    .gt("created_at", row.created_at)
    .limit(1);

  if (row.booking_request_id) {
    query = query.eq("booking_request_id", row.booking_request_id);
  } else {
    query = query.is("booking_request_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Boolean(data?.length);
}

async function markSuperseded(row, now) {
  const { error } = await supabase
    .from("email_logs")
    .update({
      retry_exhausted_at: now,
      retry_next_at: null,
      error_message: "Retry annulé : un email équivalent a été envoyé ultérieurement.",
    })
    .eq("id", row.id)
    .eq("status", "error");

  if (error) throw error;
}

async function markSuccess(row, providerId, attempts, now) {
  const { error } = await supabase
    .from("email_logs")
    .update({
      status: "sent",
      provider_id: providerId || null,
      error_message: null,
      sent_at: now,
      retry_attempts: attempts,
      retry_last_at: now,
      retry_next_at: null,
      retry_exhausted_at: null,
    })
    .eq("id", row.id)
    .eq("status", "error");

  if (error) throw error;
}

async function markFailure(row, errorMessage, attempts, now) {
  const exhausted = attempts >= MAX_RETRY_ATTEMPTS;
  const { error } = await supabase
    .from("email_logs")
    .update({
      error_message: errorMessage,
      retry_attempts: attempts,
      retry_last_at: now,
      retry_next_at: exhausted ? null : nextRetryAt(attempts, new Date(now)),
      retry_exhausted_at: exhausted ? now : null,
    })
    .eq("id", row.id)
    .eq("status", "error");

  if (error) throw error;
}

export async function runFailedEmailRetry() {
  const now = nowIso();
  const { data: rows, error } = await supabase
    .from("email_logs")
    .select("id, booking_request_id, email_type, to_email, status, created_at, retry_payload, retry_attempts, retry_next_at, retry_exhausted_at")
    .eq("status", "error")
    .is("retry_exhausted_at", null)
    .not("retry_payload", "is", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw error;

  const result = { sent: 0, failed: 0, skipped: 0 };

  for (const row of rows || []) {
    const attempts = Number(row.retry_attempts || 0);
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      await markFailure(row, "Nombre maximal de tentatives atteint.", attempts, now);
      result.skipped += 1;
      continue;
    }

    if (row.retry_next_at && new Date(row.retry_next_at).getTime() > new Date(now).getTime()) {
      result.skipped += 1;
      continue;
    }

    if (!isValidPayload(row.retry_payload)) {
      await markFailure(row, "Payload de retry invalide.", MAX_RETRY_ATTEMPTS, now);
      result.failed += 1;
      continue;
    }

    if (await equivalentEmailWasSentLater(row)) {
      await markSuperseded(row, now);
      result.skipped += 1;
      continue;
    }

    const currentAttempt = attempts + 1;
    const response = await resendEmail(row.retry_payload);

    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 1000);
      await markFailure(row, errorText, currentAttempt, now);
      result.failed += 1;
      continue;
    }

    const responseData = await response.json().catch(() => null);
    await markSuccess(row, responseData?.id || null, currentAttempt, now);
    result.sent += 1;
  }

  return result;
}

export const handler = schedule("*/15 * * * *", async () => {
  try {
    const result = await runFailedEmailRetry();
    console.log("Retry emails échoués :", result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error("Erreur retry emails :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
});
