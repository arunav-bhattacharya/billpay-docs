---
id: payment-services
title: Payment Services
sidebar_position: 1
---

# Payment Services

Payment Services are the **activity-level building blocks** that workflows
compose. Each service is owned by a single responsibility — validation, state
transition, side-effect, or notification.

A service is either:

- <span className="bp-pill bp-pill--success">Generic</span> — one implementation, used everywhere.
- A combination of <span className="bp-pill bp-pill--warn">variant</span> chips — different implementations are chosen per `source/frequency`, `account-type`, `market` or `legacy/modern integration`. **All listed variant dimensions are required** to pick the right impl — the `+` between chips denotes an AND.

For example, this is a service whose impl varies across three dimensions:

<span className="bp-pillchain">
  <span className="bp-pill bp-pill--warn">source/freq</span>
  <span className="bp-pillchain__plus">+</span>
  <span className="bp-pill bp-pill--warn">acct-type</span>
  <span className="bp-pillchain__plus">+</span>
  <span className="bp-pill bp-pill--warn">market</span>
</span>

## Idempotency

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 1 | `NewPaymentIdempotencyService` | `Input → PENDING` | Tries inserting into `idempotency_checker`, `trans_dtl`, `trans_lfcyc_event`. If row already exists → duplicate, else idempotent. Publishes `PENDING` lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> |
| 2 | `ExistingPaymentIdempotencyService` | None | Tries inserting into `idempotency_checker` for the corresponding API only. | <span className="bp-pill bp-pill--success">Generic</span> |

## Validation

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 3 | `PaymentValidationService` | `PENDING → ACCEPTED / DECLINED` | Used by the **immediate** payment workflow. Calls external systems to determine if the payment can be processed **now**. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 4 | `PaymentValidationOnSchedulingService` | `PENDING → SCHEDULED / DECLINED` | Used by the **schedule** workflow. Determines if the payment can be scheduled in the future. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 5 | `PaymentValidationOnExecutionService` | `SCHEDULED` / `ALLOCATIONS_RECEIVED` `→ ACCEPTED / DECLINED` | Used by the **execute-scheduled** workflow. Re-validates a scheduled payment on the day of execution. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 26 | `PaymentValidationOnPostingService` | `PENDING → ACCEPTED / DECLINED` | Used by `#ProcessInboundPaymentWF`. | <span className="bp-pill bp-pill--muted">TBD</span> |

## State Transition

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 6 | `PaymentStateTransitionService` | Any transition | Updates `trans_dtl.status`, appends to `trans_lfcyc_event`, publishes lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> |
| 7 | `PaymentSplitStateTransitionService` | Any split-level transition | Same as above but for `split_trans_dtl` / `split_trans_lfcyc_event`. | <span className="bp-pill bp-pill--success">Generic</span> |
| 17 | `PaymentSplitsCreationService` | `ACCEPTED` (full) → `ACCEPTED` (split) | For each split → insert into `split_trans_dtl` + `split_lfcyc_event` as `ACCEPTED` and publish lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> |

## Notification

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 8 | `PaymentScheduledNotificationService` | None | Notify systems when a payment is `SCHEDULED`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 9 | `PaymentDeclinedNotificationService` | None | Notify when a payment is `DECLINED` during immediate or scheduling. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span></span> |
| 10 | `PaymentDeclinedOnExecutionNotificationService` | None | Notify when a `SCHEDULED` payment is `DECLINED` at execution. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span></span> |

## Allocations (Corporate)

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 11 | `PaymentAllocationsRequestService` | `PENDING → ALLOCATIONS_REQUESTED` | Request allocations from GPA. | <span className="bp-pill bp-pill--success">Generic</span> |
| 12 | `PaymentAllocationsReceivedService` | `ALLOCATIONS_REQUESTED → ALLOCATIONS_RECEIVED` | Receive allocations from GPA. (Receipt-side validation TBD.) | <span className="bp-pill bp-pill--success">Generic</span> |

## Execution / Clearing / Posting / Fulfillment

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 13 | `PaymentExecutionService` *(Clearing + Posting)* | `ACCEPTED → PROCESSING` | In parallel: send to Clearing, decrement AR balance, increase Authorization OTB. Each side-effect tracked in `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">clearing system</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">legacy/modern</span></span> |
| 14 | `PaymentClearingService` | `ACCEPTED → PROCESSING` | Send to clearing only. Logged to `notification_tracker`. | <span className="bp-pill bp-pill--warn">clearing system</span> |
| 15 | `PaymentPostingService` | `ACCEPTED → PROCESSING` | Send to AR + OTB in parallel. Logged to `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">legacy/modern</span></span> |
| 16 | `PaymentFulfillmentService` | `PROCESSING → PROCESSED` | In parallel: notify Accounting, B&C, then Communications. Logged to `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">legacy/modern</span></span> |

## Cancellation

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 18 | `PaymentCancelValidationService` | None | Check current state + external eligibility. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 19 | `PaymentCancellationService` | `SCHEDULED` / `ACCEPTED → CANCELLED` | Notify external systems of cancellation. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |

## Returns & Representment

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 20 | `PaymentReturnValidationService` | None | Validate current state for a return. | <span className="bp-pill bp-pill--success">Generic</span> |
| 21 | `PaymentReturnExecutionService` | `PROCESSING` / `PROCESSED` / `PAID → RETURNED` | Notify external systems of return. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">legacy/modern</span></span> |
| 22 | `PaymentRepresentmentEligibilityService` | None | Determine if a returned payment is representable. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 23 | `PaymentRepresentmentCreationService` | `RETURNED` (Pres-seq-1) → `REPRESENTING` (Pres-seq-2) | New row in `trans_dtl` + `trans_lfcyc_event` for representment. | <span className="bp-pill bp-pill--success">Generic</span> |
| 24 | `PaymentRepresentmentValidationService` | None | On the representment day, re-check validity. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> |
| 25 | `PaymentRepresentmentExecutionService` | `REPRESENTING → REPRESENTED` | Send to clearing; notify external systems. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">clearing system</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">legacy/modern</span></span> |

## Inbound rejection

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 27 | `PaymentRejectionService` | `DECLINED → REJECTED` | Used by `#ProcessInboundPaymentWF` when a posting fails validation. | <span className="bp-pill bp-pill--muted">TBD</span> |

## Cross-reference

| # | Service | Transitions | Description | Variants |
| -- | --- | --- | --- | --- |
| 28 | `MapNewPaymentIdToPreviousIdService` | None | Insert `(old, new)` into `ORIG_TRANS_REFER_MAP` — used by `#UpdatePaymentWF`. | <span className="bp-pill bp-pill--success">Generic</span> |

:::tip
**State-transition pairings**: any service that changes state is always paired
with `PaymentStateTransitionService` (or its split-level twin). This is the
contract that keeps `trans_dtl`, `trans_lfcyc_event` and downstream event
streams in sync.
:::
