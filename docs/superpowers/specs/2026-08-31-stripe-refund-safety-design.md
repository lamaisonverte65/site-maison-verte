# Stripe Refund Safety Design (FIN-03 + FIN-05)

## Scope

Secure `refund-booking-payment` without changing FIN-04 or the commercial cancellation rules. Stripe and PostgreSQL cannot form one global transaction; the implementation must instead prevent duplicate refunds through stable idempotency and leave every uncertain external result durably reconcilable.

The authoritative business source is `public/documents/contrat-location.pdf`, version V1.1:

- the contractual deposit is 30% of the total stay price;
- more than 30 days before arrival, guest cancellation refunds all amounts paid;
- between 30 and 7 days, the deposit remains acquired and only the paid balance is refunded;
- fewer than 7 days before arrival, no amount is refunded;
- owner cancellation refunds all amounts paid.

## Existing Defects

The current function reads refundable values before the Stripe call, does not reserve them, calls `stripe.refunds.create` without an idempotency key, then performs unchecked independent writes to `payments` and `refunds`. Concurrent requests can consume the same available amount, and a Stripe success followed by a local failure can be refunded again.

The current balance calculation uses a filtered payment subset, but the execution loop iterates all refundable payments. It also loads only `payments.status = 'paid'`, excluding a partially refunded payment that still has value available.

## Durable Operation Identity

The browser creates a UUID when a cancellation/refund modal opens. Double clicks and retries while that modal remains open reuse the UUID; closing and reopening creates a new UUID and therefore a new user intention.

At first acquisition, `refund_operations.id` is immutably bound to:

- `booking_request_id`;
- `action` (`refund_only` or `cancel_refund`);
- `refund_mode`;
- custom amount in integer cents, when applicable;
- `cancellation_type`;
- whether the reservation is kept or cancelled.

A repeated UUID with any different field returns a conflict and never changes the existing operation.

## Additive Database Model

Create `refund_operations` with the immutable request fields, calculated policy label and requested cents, operation status, last error, timestamps and final result totals.

Extend `refunds` additively with nullable compatibility columns for historical rows:

- `operation_id` referencing `refund_operations`;
- `idempotency_key`;
- `allocation_order`;
- `amount_cents`;
- `operation_status`;
- `last_error`;
- `updated_at`.

New operation allocations are inserted into `refunds` before Stripe is called. Existing `refunds.amount` remains the monetary ledger value in euros; `amount_cents` is the exact integer basis for all new calculations. Keep the existing unique Stripe refund index and add unique partial indexes for `idempotency_key` and `(operation_id, payment_id)`.

No historical row is deleted or rewritten.

## Acquisition and Concurrency

A `security definer` RPC executable only by `service_role` performs acquisition in one PostgreSQL transaction:

1. Validate the operation UUID and immutable payload.
2. Return the existing operation when the UUID and payload match exactly.
3. Lock the booking row.
4. Lock relevant payment rows in deterministic order.
5. Calculate paid, succeeded-refund and reserved-allocation amounts in integer cents.
6. Insert the operation and its exact allocation rows.

Available cents for a payment are:

`paid cents - succeeded refund cents - reserved non-terminal allocation cents`

Reservations in `pending`, `in_progress`, `stripe_succeeded` and `needs_reconciliation` remain consumed. No age or timeout releases them. A failed or ambiguous request remains bound to the same operation and stable Stripe key until explicitly reconciled; there is no automatic release mechanism in this mission.

Because booking/payment locks serialize acquisition and reservations are written before commit, a different operation cannot allocate the same value while Stripe is in progress.

Every mutating refund RPC uses the same lock order: booking, payments, refund operation, then refund allocation. The operation/allocation identifiers are read without a lock only to locate their immutable booking/payment parents; ownership is revalidated after all locks are held. This avoids the previous booking-to-payment versus allocation-to-booking inversion.

## Allocation Rules

Eligible payment ledger statuses are `paid` and `partially_refunded`. Exclude `refunded`, `requires_review`, missing PaymentIntent rows and rows with no available cents.

Deterministic order is `paid_at ASC NULLS LAST`, then `created_at ASC`, then `id ASC`.

- `deposit`: only `payment_type = 'deposit'` or manual payments with `manual_reason = 'acompte'`.
- `balance`: full available value of `payment_type = 'balance'` and manual `solde`/`complement`; for `full` or manual `total`, only the economic balance tranche is eligible.
- `total`: all refundable eligible payments.
- `custom`: all refundable eligible payments, capped by the server-calculated available total.
- `policy`: owner or more-than-J-30 cancellation uses total; J-30 through J-7 uses balance; fewer than J-7 uses zero.

For a physical `full` or manual `total` payment, the payment remains one ledger row. Its remaining balance capacity is calculated in cents as:

`max(payment cents - contractual deposit cents - all consumed refund/allocation cents, 0)`

The contractual deposit is 30% of the booking total, rounded to integer cents by the same half-up rule used for Checkout amounts. Succeeded refunds and all non-terminal reservations on that payment reduce the balance capacity. A balance refund therefore cannot reduce the amount still economically retained below the contractual deposit.

## Stripe Orchestration

Each allocation uses a stable key derived only from its durable operation/allocation identity, for example `lmv-refund:<operation-id>:<refund-row-id>`.

For each allocation:

- a local succeeded allocation is skipped;
- an allocation with a Stripe refund ID is retrieved from Stripe;
- an allocation still in pristine `pending` state must first be claimed transactionally as `in_progress`; only the invocation that performs that transition may call `stripe.refunds.create`;
- an allocation already `in_progress`, failed or marked for reconciliation without a Stripe refund ID is searched through every Stripe refund page for its PaymentIntent, using exact `refund_operation_id` and `refund_allocation_id` metadata;
- exactly one matching Stripe refund is persisted locally and never recreated;
- zero matches after an exhaustive search, or multiple matches, remain `needs_reconciliation` and never trigger automatic creation;
- retries always use that same key;
- a Stripe success is persisted through a transactional result RPC;
- an exception or non-final Stripe status records a retryable/reconciliation state without releasing the allocation.

The stable key still protects close and concurrent retries, but long-lived safety does not depend on Stripe retaining that key. If Stripe succeeds and the response or local result persistence is lost, the durable `in_progress` state forces metadata reconciliation before any later decision. A crash after the local claim but before the Stripe request may therefore require human reconciliation even when an exhaustive search finds no refund; this conservative block is intentional because elapsed time cannot prove that Stripe did nothing.

## Local Finalization

The result RPC locks the allocation, payment and booking. On Stripe success it:

- marks the refund ledger row succeeded with the Stripe ID;
- recomputes the payment's succeeded refunded cents from `refunds`;
- updates `payments.refunded_amount` from that ledger total;
- sets `paid -> partially_refunded`, keeps `partially_refunded`, or sets `refunded` when no cents remain;
- recomputes `booking_requests.refunded_amount` and net `amount_paid` from succeeded ledger rows.

A finalization RPC succeeds only after every allocation in the operation is locally succeeded (or the operation legitimately has zero refund). It applies cancellation/refund-only booking fields and inserts the booking event once in the same transaction. A retry of an already succeeded operation returns the stored result and performs no new business mutation.

The email is sent only when finalization reports that this invocation performed the terminal transition. Residual risk: if PostgreSQL finalizes and the process stops before email delivery, the email may be missing. Exact delivery would require an outbox, which is outside FIN-03/FIN-05.

## Security and Rights

The migration is additive. New tables use RLS. Public, `anon` and `authenticated` receive no direct mutation rights. Acquisition/result/finalization RPCs revoke execution from those roles and grant it only to `service_role`.

No migration is applied during this mission.

## Testing

Tests cover stable keys, exact retry, concurrent acquisition behavior, exhaustive paginated metadata reconciliation, zero/multiple-match blocking, Stripe failures, Stripe-success/local-failure recovery, explicit Supabase errors, common lock ordering, mode isolation, partially refunded reuse, exact available caps, status transitions, multiple refunds sharing a PaymentIntent, the full/manual-total economic balance cap, the deposit-plus-balance integration scenario and total refund allocation across both payments.

Final verification runs targeted refund tests, all Stripe tests, the complete suite, Vite build, Node syntax checks and `git diff --check`.
