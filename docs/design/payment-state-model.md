---
id: payment-state-model
title: The Payment State Model
sidebar_position: 3
---

# The Payment State Model

Every payment in Billpay travels through a state machine. The same machine
serves both payment-level (`trans_dtl`) and split-level
(`split_trans_dtl`) records.

## The states

States are colour-coded by **lifecycle position only** — *non-terminal* (the payment is still moving) versus *terminal* (the payment is settled into a final state and will not transition further).

| State | Meaning | Terminal? |
| --- | --- | --- |
| <span className="bp-pill">PENDING</span> | The payment has been received and is awaiting initial processing. | No |
| <span className="bp-pill">SCHEDULED</span> | The payment is set to execute at a future date. | No |
| <span className="bp-pill">ALLOCATIONS_REQUESTED</span> | The payment is awaiting its allocation breakdown. | No |
| <span className="bp-pill">ALLOCATIONS_RECEIVED</span> | The payment's allocation breakdown is available. | No |
| <span className="bp-pill">ACCEPTED</span> | The payment is approved and ready to execute. | No |
| <span className="bp-pill">PROCESSING</span> | The payment is currently being executed. | No |
| <span className="bp-pill">PROCESSED</span> | The payment has been executed by Billpay; downstream confirmation is outstanding. | No |
| <span className="bp-pill">REPRESENTING</span> | The payment is being re-attempted. | No |
| <span className="bp-pill bp-pill--terminal">PAID</span> | The payment is fully settled. | **Yes** |
| <span className="bp-pill bp-pill--terminal">RETURNED</span> | The payment did not settle; funds were returned. | **Yes** |
| <span className="bp-pill bp-pill--terminal">REPRESENTED</span> | The re-attempted payment is fully settled. | **Yes** |
| <span className="bp-pill bp-pill--terminal">DECLINED</span> | The payment was not approved for execution. | **Yes** |
| <span className="bp-pill bp-pill--terminal">CANCELLED</span> | The payment was withdrawn before completion. | **Yes** |
| <span className="bp-pill bp-pill--terminal">REJECTED</span> | The payment was not accepted into Billpay. | **Yes** |

## The big picture

```mermaid
stateDiagram-v2
  classDef nonterminal fill:#bfdbfe,stroke:#1d4ed8,stroke-width:2px,color:#0c1d51,font-weight:600
  classDef terminal fill:#a16207,stroke:#713f12,stroke-width:2px,color:#fef9c3

  [*] --> PENDING

  PENDING --> SCHEDULED: validate (schedule)
  PENDING --> ACCEPTED: validate (immediate)
  PENDING --> DECLINED: validation failed
  PENDING --> REJECTED: inbound declined

  SCHEDULED --> ACCEPTED: executor fires + valid
  SCHEDULED --> DECLINED: executor fires + invalid
  SCHEDULED --> CANCELLED: cancel request
  SCHEDULED --> ALLOCATIONS_REQUESTED: corporate scheduled

  ACCEPTED --> ALLOCATIONS_REQUESTED: corporate immediate

  ALLOCATIONS_REQUESTED --> ALLOCATIONS_RECEIVED
  ALLOCATIONS_RECEIVED --> PROCESSING: split execution

  ACCEPTED --> PROCESSING: clearing / posting
  ACCEPTED --> CANCELLED
  PROCESSING --> PROCESSED: fulfillment
  PROCESSED --> PAID: AR Posted + Settled

  PAID --> RETURNED: money movement
  PROCESSED --> RETURNED
  PROCESSING --> RETURNED

  RETURNED --> REPRESENTING: eligible
  REPRESENTING --> REPRESENTED: valid representment
  REPRESENTING --> DECLINED: invalid representment

  DECLINED --> [*]
  CANCELLED --> [*]
  REJECTED --> [*]
  PAID --> [*]
  REPRESENTED --> [*]

  class PENDING,SCHEDULED,ALLOCATIONS_REQUESTED,ALLOCATIONS_RECEIVED,ACCEPTED,PROCESSING,PROCESSED,REPRESENTING nonterminal
  class PAID,RETURNED,REPRESENTED,DECLINED,CANCELLED,REJECTED terminal
```

:::info[Corporate flow nuance]
- **Corporate scheduled** → `SCHEDULED` → `ALLOCATIONS_REQUESTED` → `ALLOCATIONS_RECEIVED` → execution
- **Corporate immediate** → `ACCEPTED` → `ALLOCATIONS_REQUESTED` → `ALLOCATIONS_RECEIVED` → execution

In both cases the splits are then executed by `#ExecuteSplitPaymentWF` (on the Batch worker for Corporate).
:::

## Lifecycle events

Every state transition emits a **lifecycle event** that is:

1. Appended to `trans_lfcyc_event` (or `split_trans_lfcyc_event` for splits)
2. Published on the lifecycle event topic for downstream subscribers

The contract is enforced by `PaymentStateTransitionService` /
`PaymentSplitStateTransitionService`, which always run **alongside** the
service that triggers the transition.

For the per-workflow state-diagram view, see
[State Diagrams](diagrams/state-diagram.md).
