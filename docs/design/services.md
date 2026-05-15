---
id: services
title: Payment Services
sidebar_position: 1
---

# Payment Services

Payment Services are the **activity-level building blocks** that workflows
compose. Each service is owned by a single responsibility — validation, state
transition, side-effect, or notification.

A service is either:

- <span className="bp-pill bp-pill--success">Generic</span> — one implementation, used everywhere.
- A combination of <span className="bp-pill bp-pill--warn">variant</span> chips — different implementations are chosen per `source/frequency`, `account-type` or `market`. **All listed variant dimensions are required** to pick the right impl — the `+` between chips denotes an AND.

For example, this is a service whose impl varies across three dimensions:

<span className="bp-pillchain">
  <span className="bp-pill bp-pill--warn">source/freq</span>
  <span className="bp-pillchain__plus">+</span>
  <span className="bp-pill bp-pill--warn">acct-type</span>
  <span className="bp-pillchain__plus">+</span>
  <span className="bp-pill bp-pill--warn">market</span>
</span>

## Idempotency

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 1 | `NewPaymentIdempotencyService` | `Input → PENDING` | Tries inserting into `idempotency_checker`, `trans_dtl`, `trans_lfcyc_event`. If row already exists → duplicate, else idempotent. Publishes `PENDING` lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> | Idempotency is a platform contract — identical insert semantics everywhere. |
| 2 | `ExistingPaymentIdempotencyService` | None | Tries inserting into `idempotency_checker` for the corresponding API only. | <span className="bp-pill bp-pill--success">Generic</span> | Same idempotency contract; no per-market or per-account variance. |

## Validation

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 3 | `PaymentValidationService` | `PENDING → ACCEPTED / DECLINED` | Used by the **immediate** payment workflow. Calls external systems to determine if the payment can be processed **now**. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Eligibility rules differ per market (regulators, cutoffs, currency), per account-type (consumer vs corporate gates), and per origination source/frequency (autopay relaxes some checks; IVR enforces extras). |
| 4 | `PaymentValidationOnSchedulingService` | `PENDING → SCHEDULED / DECLINED` | Used by the **schedule** workflow. Determines if the payment can be scheduled in the future. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Same dimensions as `PaymentValidationService`; adds market-specific calendar / cutoff rules for future-dated payments. |
| 5 | `PaymentValidationOnExecutionService` | `SCHEDULED` / `ALLOCATIONS_RECEIVED` `→ ACCEPTED / DECLINED` | Used by the **execute-scheduled** workflow. Re-validates a scheduled payment on the day of execution. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Same eligibility rules re-applied at execution time — cutoff windows and account-state staleness checks are market-specific. |
| 26 | `PaymentValidationOnPostingService` | `PENDING → ACCEPTED / DECLINED` | Used by `#ProcessInboundPaymentWF`. | <span className="bp-pill bp-pill--muted">TBD</span> | Spec pending — inbound validation rules per market under design. |

## State Transition

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 6 | `PaymentStateTransitionService` | Any transition | Updates `trans_dtl.status`, appends to `trans_lfcyc_event`, publishes lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> | The state model is canonical across the platform — same writes, same event contract. |
| 7 | `PaymentSplitStateTransitionService` | Any split-level transition | Same as above but for `split_trans_dtl` / `split_trans_lfcyc_event`. | <span className="bp-pill bp-pill--success">Generic</span> | Same canonical state model applied at split granularity. |
| 17 | `PaymentSplitsCreationService` | `ACCEPTED` (full) → `ACCEPTED` (split) | For each split → insert into `split_trans_dtl` + `split_lfcyc_event` as `ACCEPTED` and publish lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> | Mechanical fan-out of split rows — allocation values come from GPA upstream. |

## Specific Event Notification

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 8 | `PaymentScheduledNotificationService` | None | Notify systems when a payment is `SCHEDULED`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Notification channels (push / email / SMS), message templates and locale differ per market and account-type; some origination sources (e.g. autopay) suppress confirmations. |
| 9 | `PaymentDeclinedNotificationService` | None | Notify when a payment is `DECLINED` during immediate or scheduling. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span></span> | Decline messaging varies by origination (IVR vs app phrasing) and account-type (corporate goes to operators, consumer to cardmember). |
| 10 | `PaymentDeclinedOnExecutionNotificationService` | None | Notify when a `SCHEDULED` payment is `DECLINED` at execution. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span></span> | Same audience-shape variance as the synchronous decline notification. |
| 29 | `PaymentInvalidReturnNotificationService` | None | Notify when a return event fails `PaymentReturnValidationService` — payment stays in its current state, no transition. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Invalid-return notification rules are set by market regulator and routed to different ops queues per account-type. |

## Allocations (Corporate)

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 11 | `PaymentAllocationsRequestService` | `PENDING → ALLOCATIONS_REQUESTED` | Request allocations from GPA. | <span className="bp-pill bp-pill--success">Generic</span> | GPA's contract is platform-wide — same request shape for all corporate accounts. |
| 12 | `PaymentAllocationsReceivedService` | `ALLOCATIONS_REQUESTED → ALLOCATIONS_RECEIVED` | Receive allocations from GPA. (Receipt-side validation TBD.) | <span className="bp-pill bp-pill--success">Generic</span> | Same — receipt-side validation may add per-market checks later. |

## Execution / Clearing / Posting / Fulfillment

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 13 | `PaymentExecutionService` *(Clearing + Posting)* | `ACCEPTED → PROCESSING` | In parallel: send to Clearing, decrement AR balance, increase Authorization OTB. Each side-effect tracked in `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">market</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span></span> | Clearing network and message format vary per market; AR + OTB posting integrations differ per account-type. |
| 14 | `PaymentClearingService` | `ACCEPTED → PROCESSING` | Send to clearing only. Logged to `notification_tracker`. | <span className="bp-pill bp-pill--warn">market</span> | Each market uses its own clearing network — different protocol, message format, and operating hours. |
| 15 | `PaymentPostingService` | `ACCEPTED → PROCESSING` | Send to AR + OTB in parallel. Logged to `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | AR and OTB systems differ per account-type (consumer card vs corporate card), and rules differ per market. |
| 16 | `PaymentFulfillmentService` | `PROCESSING → PROCESSED` | In parallel: notify Accounting, B&C, then Communications. Logged to `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Accounting integration, B&C reconciliation cadence, and communications templates all differ per market and account-type. |

## Cancellation

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 18 | `PaymentCancelValidationService` | None | Check current state + external eligibility. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">source/freq</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Cancel-eligibility windows differ per market (regulator cut-offs); corporate vs consumer have different cancel rights; some origination sources cannot cancel at all. |
| 19 | `PaymentCancellationService` | `SCHEDULED` / `ACCEPTED → CANCELLED` | Notify external systems of cancellation. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Downstream cancellation notifications are routed differently per market regulator and account-type. |

## Returns & Representment

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 20 | `PaymentReturnValidationService` | None | Validate current state for a return. | <span className="bp-pill bp-pill--success">Generic</span> | Validity is determined by canonical state — same logic everywhere. |
| 21 | `PaymentReturnExecutionService` | `PROCESSING` / `PROCESSED` / `PAID → RETURNED` | Notify external systems of return. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Reversal flows touch different AR systems per account-type and follow market-specific regulator notifications. |
| 22 | `PaymentRepresentmentEligibilityService` | None | Determine if a returned payment is representable. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Representment is governed by clearing-network rules (market) and contractual policy (account-type). |
| 23 | `PaymentRepresentmentCreationService` | `RETURNED` (Pres-seq-1) → `REPRESENTING` (Pres-seq-2) | New row in `trans_dtl` + `trans_lfcyc_event` for representment. | <span className="bp-pill bp-pill--success">Generic</span> | Mechanical — same insert path regardless of market. |
| 24 | `PaymentRepresentmentValidationService` | None | On the representment day, re-check validity. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Re-applies the same market / account-type validity rules used at origination. |
| 25 | `PaymentRepresentmentExecutionService` | `REPRESENTING → REPRESENTED` | Send to clearing; notify external systems. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">clearing system</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Clearing-network (per market), AR system (per account-type), and notification routing all vary. |

## Inbound rejection

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 27 | `PaymentRejectionService` | `DECLINED → REJECTED` | Used by `#ProcessInboundPaymentWF` when a posting fails validation. | <span className="bp-pill bp-pill--muted">TBD</span> | Spec pending — rejection-routing rules per market under design. |

## Cross-reference

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 28 | `MapNewPaymentIdToPreviousIdService` | None | Insert `(old, new)` into `ORIG_TRANS_REFER_MAP` — used by `#UpdatePaymentWF`. | <span className="bp-pill bp-pill--success">Generic</span> | Pure mapping insert — no business rule variance. |

:::tip
**State-transition pairings**: any service that changes state is always paired
with `PaymentStateTransitionService` (or its split-level twin). This is the
contract that keeps `trans_dtl`, `trans_lfcyc_event` and downstream event
streams in sync.
:::
