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
  [*] --> PENDING: NewPaymentIdempotencyService
  PENDING --> ACCEPTED: PaymentValidationOnExecuteService<br/>+ PaymentStateTransitionService
  PENDING --> DECLINED: validation failed

  ACCEPTED --> PROCESSING: PaymentExecutionService (Full)<br/>or PaymentClearingService (Split, full-level clearing)
  PROCESSING --> PROCESSED: PaymentFulfillmentService

  ACCEPTED --> ACCEPTED_SPLITS: PaymentSplitsCreationService<br/>(Consumer split)
  ACCEPTED_SPLITS --> [*]: trigger #ExecuteSplitPaymentWF
  ACCEPTED --> ALLOCATIONS_REQUESTED: corporate split<br/>(triggers #GetCorporatePaymentAllocationsWF)

  DECLINED --> [*]: PaymentDeclinedNotificationService
  PROCESSED --> [*]
```

## 2. `#CreateSchedulePaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: NewPaymentIdempotencyService
  PENDING --> SCHEDULED: PaymentValidationOnSchedulingService<br/>+ PaymentStateTransitionService
  PENDING --> DECLINED: validation failed

  SCHEDULED --> [*]: PaymentScheduledNotificationService<br/>(corporate also triggers #GetCorporatePaymentAllocationsWF)
  DECLINED --> [*]: PaymentDeclinedNotificationService
```

## 3. `#ExecuteScheduledPaymentWF`

```mermaid
stateDiagram-v2
  state Entry <<choice>>
  [*] --> Entry
  Entry --> SCHEDULED
  Entry --> ALLOCATIONS_RECEIVED

  SCHEDULED --> ACCEPTED: PaymentValidationOnExecutionService<br/>+ PaymentStateTransitionService
  ALLOCATIONS_RECEIVED --> ACCEPTED: PaymentValidationOnExecutionService<br/>+ PaymentStateTransitionService
  SCHEDULED --> DECLINED: validation failed
  ALLOCATIONS_RECEIVED --> DECLINED: validation failed

  ACCEPTED --> PROCESSING: PaymentExecutionService (Full)<br/>or PaymentClearingService (Split, full-level clearing)
  PROCESSING --> PROCESSED: PaymentFulfillmentService

  ACCEPTED --> ACCEPTED_SPLITS: PaymentSplitsCreationService<br/>(Consumer split)
  ACCEPTED_SPLITS --> [*]: trigger #ExecuteSplitPaymentWF

  DECLINED --> [*]: PaymentDeclinedOnExecutionNotificationService
  PROCESSED --> [*]
```

## 4. `#ExecuteSplitPaymentWF`

Operates at **split level** on `split_trans_dtl`.

```mermaid
stateDiagram-v2
  [*] --> ACCEPTED
  ACCEPTED --> PROCESSING: PaymentExecutionService (split, clearing-at-split)<br/>OR PaymentPostingService (split)<br/>+ PaymentSplitStateTransitionService
  PROCESSING --> PROCESSED: PaymentFulfillmentService (split)<br/>+ PaymentSplitStateTransitionService
  PROCESSED --> [*]
```

## 5. `#CancelPaymentWF`

```mermaid
stateDiagram-v2
  state CurrentState <<choice>>
  [*] --> CurrentState: ExistingPaymentIdempotencyService<br/>+ PaymentCancelValidationService
  CurrentState --> SCHEDULED
  CurrentState --> ACCEPTED
  SCHEDULED --> CANCELLED: PaymentCancellationService<br/>+ PaymentStateTransitionService
  ACCEPTED --> CANCELLED: PaymentCancellationService<br/>+ PaymentStateTransitionService
  CANCELLED --> [*]
```

## 6. `#UpdatePaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: ExistingPaymentIdempotencyService

  state "Original payment" as Orig {
    SCHEDULED --> CANCELLED: child #CancelPaymentWF
  }

  state "Replacement payment" as New {
    PENDING_new: PENDING
    PENDING_new --> SCHEDULED_new: child #CreateSchedulePaymentWF
    PENDING_new --> DECLINED_new: child #CreateSchedulePaymentWF
    SCHEDULED_new: SCHEDULED
    DECLINED_new: DECLINED
  }

  PENDING --> Orig
  PENDING --> New
  Orig --> Mapping: MapNewPaymentIdToPreviousIdService
  New --> Mapping
  Mapping --> [*]
```

## 7. `#ProcessReturnedPaymentWF`

```mermaid
stateDiagram-v2
  state Current <<choice>>
  [*] --> Current: ExistingPaymentIdempotencyService<br/>+ PaymentReturnValidationService
  Current --> PAID
  Current --> PROCESSING
  Current --> PROCESSED

  PAID --> RETURNED: PaymentReturnExecutionService<br/>+ PaymentStateTransitionService
  PROCESSING --> RETURNED: PaymentReturnExecutionService<br/>+ PaymentStateTransitionService
  PROCESSED --> RETURNED: PaymentReturnExecutionService<br/>+ PaymentStateTransitionService

  RETURNED --> REPRESENTING: PaymentRepresentmentEligibilityService<br/>+ PaymentRepresentmentCreationService
  RETURNED --> [*]
  REPRESENTING --> [*]: hand off to #ProcessRepresentmentWF
```

## 8. `#ProcessRepresentmentWF`

```mermaid
stateDiagram-v2
  [*] --> REPRESENTING: PaymentRepresentmentValidationService
  REPRESENTING --> REPRESENTED: PaymentRepresentmentExecutionService<br/>+ PaymentStateTransitionService
  REPRESENTING --> DECLINED: invalid representment<br/>+ PaymentStateTransitionService
  REPRESENTED --> [*]
  DECLINED --> [*]
```

## 9. `#GetCorporatePaymentAllocationsWF`

```mermaid
stateDiagram-v2
  state Source <<choice>>
  [*] --> Source
  Source --> SCHEDULED
  Source --> ACCEPTED

  SCHEDULED --> ALLOCATIONS_REQUESTED: AllocationsRequestService<br/>+ PaymentStateTransitionService
  ACCEPTED  --> ALLOCATIONS_REQUESTED: AllocationsRequestService<br/>+ PaymentStateTransitionService

  ALLOCATIONS_REQUESTED --> ALLOCATIONS_RECEIVED: AllocationsReceivedService<br/>+ PaymentSplitsCreationService<br/>+ PaymentStateTransitionService

  ALLOCATIONS_RECEIVED --> [*]
```

## 10. `#ProcessInboundPaymentWF`

```mermaid
stateDiagram-v2
  [*] --> PENDING: NewPaymentIdempotencyService
  PENDING --> ACCEPTED: PaymentValidationOnPostingService<br/>+ PaymentStateTransitionService
  PENDING --> DECLINED: validation failed

  ACCEPTED --> PROCESSING: PaymentPostingService<br/>+ PaymentStateTransitionService
  PROCESSING --> PROCESSED: PaymentFulfillmentService<br/>+ PaymentStateTransitionService

  ACCEPTED --> ACCEPTED_SPLITS: PaymentSplitsCreationService<br/>(Consumer split → #ExecuteSplitPaymentWF)
  ACCEPTED_SPLITS --> [*]

  DECLINED --> REJECTED: PaymentRejectionService<br/>+ PaymentStateTransitionService
  REJECTED --> [*]
  PROCESSED --> [*]
```

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
