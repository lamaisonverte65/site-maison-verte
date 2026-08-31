# Stripe Refund Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. No subagents or commits are allowed for this mission.

**Goal:** Prevent duplicate or misallocated Stripe refunds while keeping Stripe/PostgreSQL divergence durably reconcilable.

**Architecture:** PostgreSQL acquires and reserves a durable refund operation before external calls. A focused JavaScript orchestrator calls Stripe with stable per-allocation keys, persists results through service-role RPCs, and finalizes booking effects once every allocation is locally reconciled.

**Tech Stack:** Netlify Functions, Node.js, Stripe SDK, Supabase/PostgreSQL PL/pgSQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-stripe-refund-safety-design.md`

## Global Constraints

- Work only in `C:\Users\pc\Desktop\Site La MaisonVerte\Site Maison Verte - V4\travail`.
- Do not change FIN-04, initial Checkout, or the FIN-01 webhook/migration.
- Do not access production or apply migrations.
- Do not commit, push or deploy.
- Use integer cents for acquisition and allocation decisions.
- Never release ambiguous reservations by age or timeout.

---

### Task 1: Define the executable refund orchestration contract

**Files:**
- Create: `tests/refund-payment-safety.test.js`
- Create: `netlify/functions/_lib/refund-operation.js`

**Interfaces:**
- Produces `processRefundOperation({ request, dependencies })`.
- `dependencies.acquireOperation(request)` returns immutable operation data and ordered allocation rows.
- `dependencies.createStripeRefund(allocation, request)` and `retrieveStripeRefund(id)` isolate Stripe.
- `dependencies.recordStripeResult(...)`, `recordStripeFailure(...)`, and `finalizeOperation(id)` isolate transactional RPCs.

- [ ] Write failing tests for nominal creation, exact retry, two simultaneous invocations with one acquisition, stable Stripe keys, Stripe failure, local persistence failure after Stripe success, and explicit repository errors.
- [ ] Run `node --test tests/refund-payment-safety.test.js` and verify failures are caused by the missing orchestrator.
- [ ] Implement the smallest orchestrator that skips succeeded allocations, retrieves known Stripe refunds, creates unknown ones with their durable keys, persists every result, and finalizes only complete operations.
- [ ] Re-run the targeted tests until the orchestration tests pass.

### Task 2: Add the durable PostgreSQL acquisition and ledger model

**Files:**
- Create: `supabase/migrations/202608310002_secure_stripe_refunds.sql`
- Modify: `tests/refund-payment-safety.test.js`

**Interfaces:**
- Creates `public.refund_operations`.
- Extends `public.refunds` with operation/allocation state.
- Produces service-role-only RPCs `acquire_stripe_refund_operation`, `record_stripe_refund_result`, `record_stripe_refund_failure`, and `finalize_stripe_refund_operation`.

- [ ] Add failing migration-contract tests for additive schema, immutable payload conflict, booking/payment row locks, succeeded plus non-terminal reservation subtraction, no timeout release, integer-cent arithmetic, deterministic ordering, and service-role-only execution.
- [ ] Run the targeted test and verify those contracts fail against the missing migration.
- [ ] Implement the additive table/columns/indexes and `acquire_stripe_refund_operation`.
- [ ] In acquisition, calculate `available_cents = paid_cents - succeeded_cents - reserved_cents`, with pending/in-progress/Stripe-succeeded/reconciliation rows remaining reserved indefinitely.
- [ ] Implement exact deposit/balance/total/custom/policy allocation. For `full` and manual `total`, cap balance allocation to `payment_cents - contractual_deposit_cents - all_consumed_cents`.
- [ ] Implement result recording so succeeded `refunds` rows recompute each payment and booking financial aggregates from the ledger.
- [ ] Implement terminal finalization so booking state and one event are changed only once after all allocations succeed.
- [ ] Re-run targeted tests until all migration contracts pass.

### Task 3: Replace the unsafe Netlify refund sequence

**Files:**
- Modify: `netlify/functions/refund-booking-payment.js`
- Modify: `tests/refund-payment-safety.test.js`

**Interfaces:**
- Handler accepts `operationId` plus the existing booking/action/mode fields.
- Supabase adapters call only the new financial RPCs for acquisition/result/finalization.
- Stripe adapter passes `{ idempotencyKey: allocation.idempotency_key }` as the second `refunds.create` argument.

- [ ] Add failing handler/orchestrator tests proving that no direct `payments`/`refunds` mutation remains outside RPCs, local errors are surfaced, and an already-succeeded retry sends no normal email.
- [ ] Run the targeted test and verify the legacy flow fails these behaviors.
- [ ] Refactor `refund-booking-payment.js` to authorize and validate input, call `processRefundOperation`, then send the appropriate existing email only when finalization reports `shouldNotify`.
- [ ] Keep existing cancellation/refund-only email copy and keep FIN-04 fields untouched.
- [ ] Re-run targeted tests until green.

### Task 4: Give each modal intention a stable UUID

**Files:**
- Modify: `src/pages/Admin.jsx`
- Modify: `src/services/bookingActionsService.js`
- Modify: `tests/refund-payment-safety.test.js`

**Interfaces:**
- `createRefundOperationId()` returns a UUID using browser `crypto.randomUUID()`.
- Cancellation and refund-only modal state contains `refundOperationId` created once on opening.
- `refundBookingPayment` sends it as `operationId` on every retry from that modal.

- [ ] Add failing tests showing one modal reuses one ID, a reopened intention can use another ID, and the API body contains the stable ID.
- [ ] Run the targeted test and verify the old frontend contract fails.
- [ ] Add the UUID when opening cancellation/refund-only modals and forward it without regeneration during submit/retry.
- [ ] Re-run targeted tests until green.

### Task 5: Cover FIN-05 allocation scenarios

**Files:**
- Modify: `tests/refund-payment-safety.test.js`

**Interfaces:**
- Uses literal fixtures for deposit, balance, full, manual-total, partially refunded, refunded and review-required ledger entries.

- [ ] Add tests proving deposit never allocates balance, balance never allocates deposit, total spans multiple payments, partially refunded remains eligible, second refunds use remaining cents, fully consumed payments become refunded, review-required rows are excluded, and multiple Stripe refunds may share a PaymentIntent.
- [ ] Add the integration scenario deposit paid + balance paid + two partial balance refunds with deposit unchanged.
- [ ] Add the integration scenario total refund distributed across deposit and balance.
- [ ] Add full/manual-total tests proving reserved and succeeded consumption cannot reduce retained value below the contractual 30% deposit.
- [ ] Run targeted tests and correct only FIN-03/FIN-05 implementation defects until green.

### Task 6: Verification

**Files:**
- Verify all changed files; do not modify unrelated files.

- [ ] Run `node --test tests/refund-payment-safety.test.js`.
- [ ] Run all Stripe-focused tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `node --check netlify/functions/refund-booking-payment.js` and `node --check netlify/functions/_lib/refund-operation.js`.
- [ ] Run `git diff --check`.
- [ ] Inspect `git status --short` and confirm no production, deployment, commit or FIN-04 changes.
