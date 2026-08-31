export class RefundOperationError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = "RefundOperationError";
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFUND_MODES = new Set(["none", "policy", "total", "custom", "deposit", "balance"]);

export function normalizeRefundRequest(input = {}) {
  if (!UUID_PATTERN.test(String(input.operationId || ""))) {
    throw new RefundOperationError("invalid_refund_operation_id", "Un identifiant d’opération de remboursement valide est obligatoire.");
  }
  if (!UUID_PATTERN.test(String(input.bookingId || ""))) {
    throw new RefundOperationError("invalid_booking_id", "Un identifiant de réservation valide est obligatoire.");
  }

  const refundOnly = input.action === "refund_only" || input.refundOnly === true;
  const refundMode = REFUND_MODES.has(input.refundMode) ? input.refundMode : "policy";
  const cancellationType = input.cancellationType === "owner" ? "owner" : "client";
  const numericAmount = refundMode === "custom" ? Number(input.refundAmount || 0) : 0;
  if (!Number.isFinite(numericAmount) || numericAmount < 0 || !Number.isSafeInteger(Math.round(numericAmount * 100))) {
    throw new RefundOperationError("invalid_refund_amount", "Le montant de remboursement demandé est invalide.");
  }

  return {
    operationId: input.operationId,
    bookingId: input.bookingId,
    action: refundOnly ? "refund_only" : "cancel_refund",
    refundOnly,
    refundMode,
    refundAmount: refundMode === "custom" ? Math.round(numericAmount * 100) / 100 : 0,
    refundAmountCents: refundMode === "custom" ? Math.round(numericAmount * 100) : null,
    cancellationType,
    message: String(input.message || ""),
  };
}

async function recordFailureSafely(dependencies, payload) {
  try {
    await dependencies.recordStripeFailure(payload);
  } catch (recordError) {
    console.error("Unable to persist refund reconciliation state:", recordError);
  }
}

async function findMatchingStripeRefunds({ request, allocation, dependencies }) {
  const matches = [];
  let startingAfter = null;

  do {
    const page = await dependencies.listStripeRefundsPage({
      paymentIntent: allocation.payment_intent_id,
      limit: 100,
      startingAfter,
    });
    if (!page || !Array.isArray(page.data) || typeof page.has_more !== "boolean") {
      throw new RefundOperationError(
        "refund_reconciliation_incomplete",
        "La pagination Stripe des remboursements est incomplete.",
      );
    }

    for (const refund of page.data) {
      if (String(refund?.metadata?.refund_operation_id || "") === request.operationId
        && String(refund?.metadata?.refund_allocation_id || "") === allocation.id) {
        matches.push(refund);
      }
    }

    if (!page.has_more) break;
    const nextCursor = page.data.at(-1)?.id;
    if (!nextCursor || nextCursor === startingAfter) {
      throw new RefundOperationError(
        "refund_reconciliation_incomplete",
        "Stripe indique une page suivante sans curseur exploitable.",
      );
    }
    startingAfter = nextCursor;
  } while (true);

  return matches;
}

export async function processRefundOperation({ request, dependencies }) {
  const acquired = await dependencies.acquireOperation(request);
  const allocations = acquired.allocations || [];

  for (const allocation of allocations) {
    if (allocation.operation_status === "succeeded") continue;

    let stripeRefund;
    try {
      if (allocation.stripe_refund_id) {
        stripeRefund = await dependencies.retrieveStripeRefund(allocation.stripe_refund_id);
      } else {
        const claim = await dependencies.claimAllocation({
          operationId: request.operationId,
          allocationId: allocation.id,
        });

        if (claim.outcome === "claimed_first_attempt") {
          stripeRefund = await dependencies.createStripeRefund({
          payment_intent: allocation.payment_intent_id,
          amount: Number(allocation.amount_cents),
          metadata: {
            booking_id: request.bookingId,
            payment_id: allocation.payment_id,
            refund_operation_id: request.operationId,
            refund_allocation_id: allocation.id,
            cancellation_type: request.cancellationType,
            refund_mode: request.refundMode,
            action: request.refundOnly || request.action === "refund_only" ? "refund_only" : "cancel_refund",
          },
        }, {
          idempotencyKey: allocation.idempotency_key,
          });
        } else {
          const matches = await findMatchingStripeRefunds({ request, allocation, dependencies });
          if (matches.length !== 1) {
            const reason = matches.length === 0
              ? "stripe_refund_not_found_after_exhaustive_search"
              : "multiple_matching_stripe_refunds";
            await recordFailureSafely(dependencies, {
              operationId: request.operationId,
              allocationId: allocation.id,
              status: "needs_reconciliation",
              error: reason,
            });
            return {
              outcome: "needs_reconciliation",
              reason,
              refundedAmount: 0,
              operationId: request.operationId,
            };
          }
          [stripeRefund] = matches;
        }
      }
    } catch (error) {
      await recordFailureSafely(dependencies, {
        operationId: request.operationId,
        allocationId: allocation.id,
        status: "needs_reconciliation",
        error: error.message,
      });
      throw error;
    }

    try {
      await dependencies.recordStripeResult({
        operationId: request.operationId,
        allocationId: allocation.id,
        stripeRefundId: stripeRefund.id,
        stripeStatus: stripeRefund.status,
        stripeMetadata: stripeRefund,
      });
    } catch (error) {
      await recordFailureSafely(dependencies, {
        operationId: request.operationId,
        allocationId: allocation.id,
        stripeRefundId: stripeRefund.id,
        status: stripeRefund.status === "succeeded" ? "stripe_succeeded" : "needs_reconciliation",
        error: error.message,
      });
      throw new RefundOperationError(
        "refund_needs_reconciliation",
        `Stripe a répondu mais l’état local doit être réconcilié : ${error.message}`,
        error,
      );
    }

    if (stripeRefund.status !== "succeeded") {
      return {
        outcome: "needs_reconciliation",
        refundedAmount: 0,
        operationId: request.operationId,
      };
    }
  }

  const finalized = await dependencies.finalizeOperation(request.operationId);
  if (finalized.should_notify) {
    await dependencies.notify({ request, result: finalized });
  }

  return {
    ...finalized,
    operationId: request.operationId,
    refundedAmount: Number(finalized.refunded_amount_cents || 0) / 100,
  };
}
