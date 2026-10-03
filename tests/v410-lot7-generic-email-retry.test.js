import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("Lot 7 migration adds durable retry fields to email_logs", () => {
  const sql = read("supabase/migrations/202610040001_v410_generic_email_retry.sql");
  assert.match(sql, /alter table\s+public\.email_logs/i);
  assert.match(sql, /retry_payload\s+jsonb/i);
  assert.match(sql, /retry_attempts\s+integer/i);
  assert.match(sql, /retry_next_at\s+timestamptz/i);
  assert.match(sql, /retry_last_at\s+timestamptz/i);
  assert.match(sql, /retry_exhausted_at\s+timestamptz/i);
});

test("generic retry cron only resends stored email payloads and never replays business actions", () => {
  const source = read("netlify/functions/retry-failed-emails.js");
  assert.match(source, /schedule\("\*\/15 \* \* \* \*"/);
  assert.match(source, /\.from\("email_logs"\)/);
  assert.match(source, /\.eq\("status", "error"\)/);
  assert.match(source, /retry_payload/);
  assert.match(source, /retry_attempts/);
  assert.match(source, /retry_exhausted_at/);
  assert.match(source, /resendEmail\(row\.retry_payload\)/);
  assert.match(read("netlify/functions/_lib/resend-email.js"), /api\.resend\.com\/emails/);
  assert.doesNotMatch(source, /booking_requests/);
  assert.doesNotMatch(source, /payments/);
  assert.doesNotMatch(source, /refund/);
  assert.doesNotMatch(source, /stripe/i);
});

test("retry cron deduplicates a failed log when an equivalent later email was sent", () => {
  const source = read("netlify/functions/retry-failed-emails.js");
  assert.match(source, /\.eq\("booking_request_id", row\.booking_request_id\)/);
  assert.match(source, /\.eq\("email_type", row\.email_type\)/);
  assert.match(source, /\.eq\("to_email", row\.to_email\)/);
  assert.match(source, /\.eq\("status", "sent"\)/);
  assert.match(source, /\.gt\("created_at", row\.created_at\)/);
});

test("critical payment and refund email errors persist an exact retry payload", () => {
  for (const file of [
    "netlify/functions/stripe-webhook.js",
    "netlify/functions/refund-booking-payment.js",
    "netlify/functions/send-booking-decision.js",
    "netlify/functions/check-balance-payments.js",
    "netlify/functions/check-expired-bookings.js",
  ]) {
    const source = read(file);
    assert.match(source, /retryPayload/);
    assert.match(source, /retry_payload/);
    assert.match(source, /html/);
    assert.match(source, /subject/);
  }
});

test("admin-triggered booking emails also persist retry payloads", () => {
  for (const file of [
    "netlify/functions/send-manual-payment-email.js",
    "netlify/functions/create-balance-checkout-session.js",
  ]) {
    const source = read(file);
    assert.match(source, /retry_payload/);
    assert.match(source, /resendEmail/);
    assert.match(source, /email_logs/);
  }
});

test("arrival-link recovery is not blindly retried because its one-time token is restored on delivery failure", () => {
  const source = read("netlify/functions/_lib/arrival-link-recovery.js");
  assert.match(source, /restoreToken/);
  assert.doesNotMatch(source, /retry_payload/);
});
