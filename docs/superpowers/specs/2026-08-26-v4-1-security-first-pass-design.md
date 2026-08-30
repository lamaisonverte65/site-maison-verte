# V4.1 Security First Pass Design

## Scope

This design implements only SEC-01, AUTH-03, AUTH-01, AUTH-04, SEC-05, and SEC-02 from the approved V4.1 security brief. It preserves anonymous booking requests, existing administrative roles, housekeeping access, scheduled emails, and the account-free arrival-time flow. It does not change production RLS, deploy, payment/refund rules, or external services.

## Authorization boundary

All user-invoked privileged Netlify functions use one server-only authorization helper. A request is accepted only when the bearer token maps to a Supabase Auth user and that user maps to an active `admin_users` row. Missing environment allowlists never grant access. Owner authority requires the database profile to be both `role = owner` and `is_owner = true`; other actions require an explicit effective permission from the shared role/permission model.

The shared permission model is consumed by both React and Netlify code. Unknown roles, absent profiles, absent permission sets, and invalid permissions fail closed. The user-management API exposes a minimal `me` action to every active internal account and protects `list` with `view:users`.

## User administration

The server accepts only known non-owner roles for normal create/update operations and only known permissions. A non-owner may delegate only permissions in their own effective permission set and can never delegate ownership transfer. Non-owners cannot mutate, delete, deactivate, or reset the password of the owner. Ownership changes remain exclusively in `transfer_owner`, which itself requires the current owner.

## Email flows

The public booking endpoint validates a strict field schema, normalizes sizes and types, rejects unexpected fields, escapes all user values before HTML insertion, and fixes the administrative recipient and templates server-side. It uses the trusted Netlify request context plus the service-role-only rate-limit table to enforce five attempts per IP per minute. A second atomic fingerprint claim suppresses concurrent identical submissions for five minutes. It creates the validated booking row itself and then sends the two fixed emails; the browser no longer supplies a pre-created booking row as the source of truth.

Administrative email/payment endpoints require server authorization and read recipient, stay data, and existing payment details from Supabase by booking ID. Payment links are generated server-side or accepted only when they are stored Stripe Checkout links. User-controlled HTML is escaped.

## Arrival-time capability

Arrival reminder emails create a random 256-bit token, store only its SHA-256 hash and expiry on the booking, and include the plaintext token only in the emailed URL. The update endpoint requires booking ID plus token, compares hashes in constant time, accepts only `HH:MM`, and rejects expired, cancelled, refused, pending, or completed stays. Legacy rows without a token fail closed and require a new reminder link after the migration is applied.

Legacy booking-only links expose a recovery form that submits the booking identifier together with the email address and family name originally used for the booking. The public recovery endpoint is deliberately non-enumerable: malformed input, an unknown booking, an identity mismatch, an ineligible stay, throttling, and internal or email-provider failure all return the same HTTP status and public response body. The response never confirms that a booking or identity exists and never returns a capability token to the browser.

When and only when all stored values match an eligible booking, the server atomically replaces the stored token hash and sends the plaintext token in a new secure link to the email address already stored on that booking. The submitted email address can qualify the request but can never select the recipient. A failed delivery restores the previous token state so an existing secure link is not silently invalidated.

Recovery runs as a Netlify background function, so every accepted invocation receives the same immediate empty `202` independently of booking lookup, matching, throttling, database work, or email delivery time. The trusted Netlify request context supplies the client IP; client-controlled forwarding headers are not used.

Recovery is throttled durably and atomically in Supabase at two boundaries: an opaque HMAC of the trusted client IP may claim at most three attempts per hour, and an opaque HMAC of the submitted booking identifier may claim at most one attempt every fifteen minutes. The rate-limit table is service-role-only and stores neither raw IP addresses nor raw booking identifiers. Concurrent valid requests additionally race on the same atomic booking token claim and therefore produce at most one email. Existing reminder history is appended to, never deleted or rewritten.

## External calendar scheduler

`check-external-calendar-alerts` becomes a true Netlify scheduled function. Netlify's installed type declaration and official documentation state that scheduled functions are not reachable by HTTP, so no frontend/user token or duplicated shared secret is introduced. The job claims alerts before sending so concurrent invocations cannot send the same alert twice.

## Verification

Node's built-in test runner covers authorization states, escalation attempts, public email validation/escaping, arrival tokens, and scheduled-alert claiming. Final verification includes all tests, Vite build, syntax checks for every Netlify function, repository-wide security searches, secret scans, `git diff`, and `git status`.
