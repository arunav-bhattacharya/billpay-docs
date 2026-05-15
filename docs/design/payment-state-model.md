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
| <span className="bp-pill">PENDING</span> | Request accepted into Billpay; idempotency row written | No |
| <span className="bp-pill">SCHEDULED</span> | Validated for a future-dated payment; waiting for the executor | No |
| <span className="bp-pill">ALLOCATIONS_REQUESTED</span> | Corporate payment — GPA asked for allocation breakdown | No |
| <span className="bp-pill">ALLOCATIONS_RECEIVED</span> | GPA returned allocations; ready to execute splits | No |
| <span className="bp-pill">ACCEPTED</span> | Validated for execution today | No |
| <span className="bp-pill">PROCESSING</span> | Sent to Clearing / Posting; awaiting fulfillment | No |
| <span className="bp-pill">PROCESSED</span> | Internally fulfilled (Accounting / B&C / Comms notified) | No |
| <span className="bp-pill">REPRESENTING</span> | Retry transaction created after a return | No |
| <span className="bp-pill bp-pill--terminal">PAID</span> | AR posted **and** Clearing settled — closed out | **Yes** |
| <span className="bp-pill bp-pill--terminal">RETURNED</span> | Money came back from clearing | **Yes** |
| <span className="bp-pill bp-pill--terminal">REPRESENTED</span> | Representment cleared successfully | **Yes** |
| <span className="bp-pill bp-pill--terminal">DECLINED</span> | Validation failed (either at scheduling or at execution) | **Yes** |
| <span className="bp-pill bp-pill--terminal">CANCELLED</span> | Cancelled before reaching `PROCESSING` | **Yes** |
| <span className="bp-pill bp-pill--terminal">REJECTED</span> | Inbound payment declined and rejected back | **Yes** |

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
