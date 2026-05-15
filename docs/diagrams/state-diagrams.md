---
id: state-diagrams
title: State Diagrams
sidebar_position: 1
---

# State Diagrams

One state diagram per workflow. Each diagram captures every transition the
workflow can perform and which **Payment Service(s)** drive it.

For a single, combined view of the full state model, see
[The Payment State Model](../architecture/state-model.md).

## 1. `#CreateImmediatePaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> ACCEPTED: validate
  PENDING --> DECLINED: invalid

  ACCEPTED --> PROCESSING: execute (Full / Split)
  PROCESSING --> PROCESSED: fulfill

  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: → #ExecuteSplitPaymentWF
  ACCEPTED --> ALLOCATIONS_REQUESTED: if Corporate

  DECLINED --> [*]: notify
  PROCESSED --> [*]
```

:::note[Service mapping]
- **idempotency** → `NewPaymentIdempotencyService`
- **validate** → `PaymentValidationService` + `PaymentStateTransitionService`
- **execute (Full / Split)** → `PaymentExecutionService` *(Full)* or `PaymentClearingService` *(Split, full-level clearing)*
- **fulfill** → `PaymentFulfillmentService`
- **create splits (Consumer)** → `PaymentSplitsCreationService`
- **if Corporate** → triggers `#GetCorporatePaymentAllocationsWF`
- **notify** (DECLINED) → `PaymentDeclinedNotificationService`
:::

## 2. `#CreateSchedulePaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> SCHEDULED: validate
  PENDING --> DECLINED: invalid

  SCHEDULED --> [*]: notify
  DECLINED --> [*]: notify
```

:::note[Service mapping]
- **idempotency** → `NewPaymentIdempotencyService`
- **validate** → `PaymentValidationOnSchedulingService` + `PaymentStateTransitionService`
- **notify** (SCHEDULED) → `PaymentScheduledNotificationService` *(Corporate additionally triggers `#GetCorporatePaymentAllocationsWF`)*
- **notify** (DECLINED) → `PaymentDeclinedNotificationService`
:::

## 3. `#ExecuteScheduledPaymentWF`

```mermaid
stateDiagram-v2
  state Entry <<choice>>
  [*] --> Entry
  Entry --> SCHEDULED
  Entry --> ALLOCATIONS_RECEIVED

  SCHEDULED --> ACCEPTED: validate
  ALLOCATIONS_RECEIVED --> ACCEPTED: validate
  SCHEDULED --> DECLINED: invalid
  ALLOCATIONS_RECEIVED --> DECLINED: invalid

  ACCEPTED --> PROCESSING: execute (Full / Split)
  PROCESSING --> PROCESSED: fulfill

  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: → #ExecuteSplitPaymentWF

  DECLINED --> [*]: notify
  PROCESSED --> [*]
```

:::note[Service mapping]
- **validate** → `PaymentValidationOnExecutionService` + `PaymentStateTransitionService`
- **execute (Full / Split)** → `PaymentExecutionService` *(Full)* or `PaymentClearingService` *(Split, full-level clearing)*
- **fulfill** → `PaymentFulfillmentService`
- **create splits (Consumer)** → `PaymentSplitsCreationService`
- **notify** (DECLINED) → `PaymentDeclinedOnExecutionNotificationService`
:::

## 4. `#ExecuteSplitPaymentWF`

Operates at **split level** on `split_trans_dtl`.

```mermaid
stateDiagram-v2
  [*] --> ACCEPTED
  ACCEPTED --> PROCESSING: execute (clearing / posting)
  PROCESSING --> PROCESSED: fulfill
  PROCESSED --> [*]
```

:::note[Service mapping]
- **execute (clearing / posting)** → `PaymentExecutionService` *(split, clearing-at-split)* **or** `PaymentPostingService` *(split)*, both paired with `PaymentSplitStateTransitionService`
- **fulfill** → `PaymentFulfillmentService` *(split)* + `PaymentSplitStateTransitionService`
:::

## 5. `#CancelPaymentWF`

```mermaid
stateDiagram-v2
  state CurrentState <<choice>>
  [*] --> CurrentState: idempotency + validate
  CurrentState --> SCHEDULED
  CurrentState --> ACCEPTED
  SCHEDULED --> CANCELLED: cancel
  ACCEPTED --> CANCELLED: cancel
  CANCELLED --> [*]
```

:::note[Service mapping]
- **idempotency + validate** → `ExistingPaymentIdempotencyService` + `PaymentCancelValidationService`
- **cancel** → `PaymentCancellationService` + `PaymentStateTransitionService`
:::

## 6. `#UpdatePaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency

  state "Original payment" as Orig {
    SCHEDULED --> CANCELLED: → #CancelPaymentWF
  }

  state "Replacement payment" as New {
    PENDING_new: PENDING
    PENDING_new --> SCHEDULED_new: → #CreateSchedulePaymentWF
    PENDING_new --> DECLINED_new: → #CreateSchedulePaymentWF
    SCHEDULED_new: SCHEDULED
    DECLINED_new: DECLINED
  }

  PENDING --> Orig
  PENDING --> New
  Orig --> Mapping: map old → new
  New --> Mapping
  Mapping --> [*]
```

:::note[Service mapping]
- **idempotency** → `ExistingPaymentIdempotencyService`
- **→ #CancelPaymentWF / → #CreateSchedulePaymentWF** → child workflows
- **map old → new** → `MapNewPaymentIdToPreviousIdService` *(records the relationship in `ORIG_TRANS_REFER_MAP`)*
:::

## 7. `#ProcessReturnedPaymentWF`

```mermaid
stateDiagram-v2
  state Current <<choice>>
  [*] --> Current: idempotency + validate
  Current --> PAID
  Current --> PROCESSING
  Current --> PROCESSED

  PAID --> RETURNED: return
  PROCESSING --> RETURNED: return
  PROCESSED --> RETURNED: return

  RETURNED --> REPRESENTING: create representment
  RETURNED --> [*]
  REPRESENTING --> [*]: → #ProcessRepresentmentWF
```

:::note[Service mapping]
- **idempotency + validate** → `ExistingPaymentIdempotencyService` + `PaymentReturnValidationService`
- **return** → `PaymentReturnExecutionService` + `PaymentStateTransitionService`
- **create representment** → `PaymentRepresentmentEligibilityService` + `PaymentRepresentmentCreationService`
:::

## 8. `#ProcessRepresentmentWF`

```mermaid
stateDiagram-v2
  [*] --> REPRESENTING: validate
  REPRESENTING --> REPRESENTED: execute
  REPRESENTING --> DECLINED: invalid
  REPRESENTED --> [*]
  DECLINED --> [*]
```

:::note[Service mapping]
- **validate** → `PaymentRepresentmentValidationService`
- **execute** → `PaymentRepresentmentExecutionService` + `PaymentStateTransitionService`
- **invalid** → state transition only via `PaymentStateTransitionService`
:::

## 9. `#GetCorporatePaymentAllocationsWF`

```mermaid
stateDiagram-v2
  state Source <<choice>>
  [*] --> Source
  Source --> SCHEDULED
  Source --> ACCEPTED

  SCHEDULED --> ALLOCATIONS_REQUESTED: request
  ACCEPTED  --> ALLOCATIONS_REQUESTED: request

  ALLOCATIONS_REQUESTED --> ALLOCATIONS_RECEIVED: receive + create splits

  ALLOCATIONS_RECEIVED --> [*]
```

:::note[Service mapping]
- **request** → `AllocationsRequestService` + `PaymentStateTransitionService`
- **receive + create splits** → `AllocationsReceivedService` + `PaymentSplitsCreationService` + `PaymentStateTransitionService`
:::

## 10. `#ProcessInboundPaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> ACCEPTED: validate
  PENDING --> DECLINED: invalid

  ACCEPTED --> PROCESSING: post
  PROCESSING --> PROCESSED: fulfill

  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: → #ExecuteSplitPaymentWF

  DECLINED --> REJECTED: reject
  REJECTED --> [*]
  PROCESSED --> [*]
```

:::note[Service mapping]
- **idempotency** → `NewPaymentIdempotencyService`
- **validate** → `PaymentValidationOnPostingService` + `PaymentStateTransitionService`
- **post** → `PaymentPostingService` + `PaymentStateTransitionService`
- **fulfill** → `PaymentFulfillmentService` + `PaymentStateTransitionService`
- **create splits (Consumer)** → `PaymentSplitsCreationService`
- **reject** → `PaymentRejectionService` + `PaymentStateTransitionService`
:::

## 11. `#CreateBalanceRefundWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> ACCEPTED
  PENDING --> DECLINED
  ACCEPTED --> PROCESSING
  PROCESSING --> PROCESSED
  PROCESSED --> [*]
  DECLINED --> [*]
```
