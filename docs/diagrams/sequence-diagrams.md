---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_position: 2
---

# Sequence Diagrams

End-to-end traces from a caller's perspective. Each diagram covers a complete
Billpay flow — **One-Data function → Core API → Router → Workflows →
Payment Services**.

Most diagrams show two groups at the top:

- **Caller** — the caller side (soft slate)
- **Billpay Platform** — everything past the contract: Core API, Router, Workflows, and named Payment Services (light blue)

Internal reconciliation flows (event handlers + schedules) show only the Billpay Platform group.

Inside the body:

- **Blue-tinted rectangles** wrap the messages that belong to a single workflow (the workflow name is labeled at the top of the block).
- **Amber-tinted rectangles** mark async work that happens *after* the client has been responded to.
- **Fuchsia/pink-tinted rectangles** pop out **state transitions** — moments where the payment moves from one lifecycle state to another (`PENDING → ACCEPTED`, `PROCESSING → PROCESSED`, etc.).

Each Payment Service appears as its **own participant**. To keep diagrams readable, the participant label drops the redundant `Payment` prefix and `Service` suffix — e.g., `Execution` represents `PaymentExecutionService`, `Idempotency Check` covers both `NewPaymentIdempotencyService` and `ExistingPaymentIdempotencyService`. External systems and infrastructure (clearing, AR, OTB, accounting, database, event bus) are intentionally omitted — they're internal implementation details of the services that own them.

## 1. Immediate payment — single instruction

`CreatePayment.v3` → `POST /payments` (today, single instruction) →
`#CreateImmediatePaymentWF`.

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Caller
    participant C as Client
    participant ODF as CreatePayment.v3
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant WF as Create Immediate Payment WF
    participant IDEMP as Idempotency Check
    participant PVAL as Validation
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>ODF: CreatePayment.v3 (date=today, single)
  ODF->>API: POST /payments
  API->>R: route(date=today, single)
  R->>WF: invoke(workflow-key)

  rect rgba(0,111,207,0.15)
    Note over WF,PVAL: Realtime Worker · #CreateImmediatePaymentWF — validates and accepts inline
    WF->>IDEMP: check idempotency
    rect rgba(217,70,239,0.22)
      IDEMP-->>WF: state → PENDING
    end
    WF->>PVAL: validate
    rect rgba(217,70,239,0.22)
      PVAL-->>WF: state → ACCEPTED
    end
  end

  Note over C,WF: Client receives 201 ACCEPTED — payment is durable, fulfillment continues in the background
  WF-->>API: success (payment-id, ACCEPTED)
  API-->>ODF: 201 Created
  ODF-->>C: payment-id, status=ACCEPTED

  rect rgba(245,158,11,0.18)
    Note over WF,PFL: Async fulfillment — execution and fulfillment run after the client response
    WF->>PEX: execute
    rect rgba(217,70,239,0.22)
      PEX-->>WF: state → PROCESSING
    end
    WF->>PFL: fulfill
    rect rgba(217,70,239,0.22)
      PFL-->>WF: state → PROCESSED
    end
  end
```

## 2. Scheduled payment — created today, executed later

`CreatePayment.v3` → `POST /payments` (future date) →
`#CreateSchedulePaymentWF` → later → `#ExecuteScheduledPaymentWF`.

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Caller
    participant C as Client
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CSP as Create Schedule Payment WF
    participant IDEMP as Idempotency Check
    participant PVS as Validation (Schedule)
    participant PSN as Scheduled Notify
    participant SCH as Scheduled Payment Executor
    participant ESP as Execute Scheduled Payment WF
    participant PVX as Validation (Execution)
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (date=future)
  API->>R: route(date=future)
  R->>CSP: invoke(workflow-key)

  rect rgba(0,111,207,0.15)
    Note over CSP,PSN: Realtime Worker · #CreateSchedulePaymentWF — validates the schedule, returns SCHEDULED
    CSP->>IDEMP: check idempotency
    rect rgba(217,70,239,0.22)
      IDEMP-->>CSP: state → PENDING
    end
    CSP->>PVS: validate schedule
    rect rgba(217,70,239,0.22)
      PVS-->>CSP: state → SCHEDULED
    end
    CSP->>PSN: notify scheduled
  end

  CSP-->>API: SCHEDULED
  API-->>C: 201 Created (SCHEDULED)

  Note over SCH,ESP: On payment date · Scheduled Payment Executor fires (waves of 2,500 / minute)

  rect rgba(245,158,11,0.18)
    Note over SCH,PFL: Batch Worker · #ExecuteScheduledPaymentWF — re-validates, executes and fulfills
    SCH->>ESP: pick up SCHEDULED payments (batches of 2,500/min)
    ESP->>PVX: validate
    rect rgba(217,70,239,0.22)
      PVX-->>ESP: state → ACCEPTED
    end
    ESP->>PEX: execute
    rect rgba(217,70,239,0.22)
      PEX-->>ESP: state → PROCESSING
    end
    ESP->>PFL: fulfill
    rect rgba(217,70,239,0.22)
      PFL-->>ESP: state → PROCESSED
    end
  end
```

:::note[After PROCESSED]
`PAID` is reached separately by the **Paid Events Processor reconciliation** — see [diagram #8](#8-paid-events-reconciliation).
:::

## 3. Corporate payment with allocations

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Caller
    participant C as Client
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant P as Parent Workflow
    participant IDEMP as Idempotency Check
    participant PVAL as Validation
    participant PVS as Validation (Schedule)
    participant GPA as Get Corporate Payment Allocations WF
    participant ARQ as Allocations Request
    participant ARC as Allocations Received
    participant PSC as Splits Creation
    participant ESP as Execute Split Payment WF
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (corporate)
  API->>R: route
  R->>P: invoke

  rect rgba(0,111,207,0.15)
    Note over P,PVS: Realtime Worker · parent is either #CreateImmediatePaymentWF or #CreateSchedulePaymentWF
    P->>IDEMP: check idempotency
    rect rgba(217,70,239,0.22)
      IDEMP-->>P: state → PENDING
    end
    alt parent is CreateImmediatePaymentWF
      P->>PVAL: validate
      rect rgba(217,70,239,0.22)
        PVAL-->>P: state → ACCEPTED
      end
    else parent is CreateSchedulePaymentWF
      P->>PVS: validate schedule
      rect rgba(217,70,239,0.22)
        PVS-->>P: state → SCHEDULED
      end
    end
  end

  Note over C,P: Client receives 201 ACCEPTED or SCHEDULED — allocations and split execution run in the background
  P-->>API: success (payment-id, ACCEPTED or SCHEDULED)
  API-->>C: 201 Created

  rect rgba(245,158,11,0.18)
    Note over P,PFL: Async — corporate allocations are fetched, then per-split execution runs in waves

    rect rgba(0,111,207,0.15)
      Note over GPA,PSC: Batch Worker · #GetCorporatePaymentAllocationsWF — fetches the split breakdown
      P->>GPA: trigger allocations workflow
      GPA->>ARQ: request allocations
      rect rgba(217,70,239,0.22)
        ARQ-->>GPA: state → ALLOCATIONS_REQUESTED
      end
      GPA->>ARC: process allocations payload
      rect rgba(217,70,239,0.22)
        ARC-->>GPA: state → ALLOCATIONS_RECEIVED
      end
      GPA->>PSC: create payment splits
    end

    rect rgba(0,111,207,0.15)
      Note over ESP,PFL: Batch Worker · #ExecuteSplitPaymentWF — drained by the Corporate Allocations Processor Schedule
      GPA->>ESP: trigger split execution
      ESP->>PEX: execute split
      rect rgba(217,70,239,0.22)
        PEX-->>ESP: state → PROCESSING
      end
      ESP->>PFL: fulfill split
      rect rgba(217,70,239,0.22)
        PFL-->>ESP: state → PROCESSED
      end
    end
  end
```

## 4. Update a scheduled payment

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Caller
    participant C as Client
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as PUT /payments/:id
    participant U as Update Payment WF
    participant IDEMP as Idempotency Check
    participant CAN as Cancel Payment WF
    participant PCV as Cancel Validation
    participant PCN as Cancellation
    participant CSP as Create Schedule Payment WF
    participant MAP as Map ID Old → New
  end

  C->>API: PUT /payments/:id
  API->>U: invoke

  rect rgba(0,111,207,0.15)
    Note over U,MAP: Realtime Worker · #UpdatePaymentWF — cancels the original, creates a replacement, maps old → new
    U->>IDEMP: check idempotency
    rect rgba(217,70,239,0.22)
      IDEMP-->>U: state → PENDING
    end

    rect rgba(0,111,207,0.18)
      U->>CAN: cancel original
      CAN->>PCV: validate cancel
      CAN->>PCN: cancel
      rect rgba(217,70,239,0.22)
        PCN-->>CAN: state → CANCELLED
      end
      CAN-->>U: cancelled
    end

    rect rgba(0,111,207,0.18)
      U->>CSP: create replacement
      rect rgba(217,70,239,0.22)
        CSP-->>U: new payment-id (state → SCHEDULED or DECLINED)
      end
    end

    U->>MAP: map old → new
  end

  U-->>API: success(new payment-id)
  API-->>C: 200 OK
```

## 5. Cancel a payment

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Caller
    participant C as Client
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as DELETE /payments/:id
    participant CWF as Cancel Payment WF
    participant IDEMP as Idempotency Check
    participant PCV as Cancel Validation
    participant PCN as Cancellation
  end

  C->>API: DELETE /payments/:id
  API->>CWF: invoke

  rect rgba(0,111,207,0.15)
    Note over CWF,PCN: Realtime Worker · #CancelPaymentWF — checks eligibility and transitions to CANCELLED
    CWF->>IDEMP: check idempotency
    CWF->>PCV: validate cancel
    alt eligible
      CWF->>PCN: cancel
      rect rgba(217,70,239,0.22)
        PCN-->>CWF: state → CANCELLED
      end
      CWF-->>API: CANCELLED
    else not eligible
      CWF-->>API: error
    end
  end

  API-->>C: response
```

## 6. Return processing (with representment branch)

```mermaid
sequenceDiagram
  autonumber

  box rgba(0,111,207,0.08) Billpay Platform
    participant MMH as Money Movement Event Handler
    participant API as POST /payments/returns
    participant PR as Process Returned Payment WF
    participant IDEMP as Idempotency Check
    participant PRV as Return Validation
    participant PRX as Return Execution
    participant PRE as Representment Elig.
    participant PRC as Representment Create
    participant PRP as Process Representment WF
    participant PRRV as Representment Validate
    participant PRRX as Representment Execute
  end

  Note over MMH: receives Money Movement (MR/M3) return event
  MMH->>API: POST /payments/returns
  API->>PR: invoke

  rect rgba(0,111,207,0.15)
    Note over PR,PRC: Batch Worker · #ProcessReturnedPaymentWF — triggered by Money Movement return events
    PR->>IDEMP: check idempotency
    PR->>PRV: validate return
    alt valid return
      PR->>PRX: execute return
      rect rgba(217,70,239,0.22)
        PRX-->>PR: state → RETURNED
      end
      PR->>PRE: check representment eligibility
      alt representable
        PR->>PRC: create representment
        rect rgba(217,70,239,0.22)
          PRC-->>PR: state → REPRESENTING
        end
        PR->>PRP: hand off

        rect rgba(0,111,207,0.18)
          Note over PRP,PRRX: Batch Worker · #ProcessRepresentmentWF — re-clears a returned transaction on the representment day
          PRP->>PRRV: validate representment
          alt valid representment
            PRP->>PRRX: execute representment
            rect rgba(217,70,239,0.22)
              PRRX-->>PRP: state → REPRESENTED
            end
          else invalid
            rect rgba(217,70,239,0.22)
              Note over PRP: state → DECLINED
            end
          end
        end
      end
    end
  end
```

## 7. Inbound payment

```mermaid
sequenceDiagram
  autonumber

  box rgba(0,111,207,0.08) Billpay Platform
    participant UPH as Unstructured Payment Handler
    participant API as POST /payments/inbound
    participant IB as Process Inbound Payment WF
    participant IDEMP as Idempotency Check
    participant PVP as Validation (Posting)
    participant PPS as Posting
    participant PFL as Fulfillment
    participant PSC as Splits Creation
    participant PRJ as Rejection
  end

  Note over UPH: receives Batch Gateway payment event, enriches payload
  UPH->>API: POST /payments/inbound
  API->>IB: invoke

  rect rgba(0,111,207,0.15)
    Note over IB,PRJ: Batch Worker · #ProcessInboundPaymentWF — posts an upstream-originated payment into Billpay
    IB->>IDEMP: check idempotency
    rect rgba(217,70,239,0.22)
      IDEMP-->>IB: state → PENDING
    end
    IB->>PVP: validate posting
    alt accepted (Full)
      IB->>PPS: post
      rect rgba(217,70,239,0.22)
        PPS-->>IB: state → PROCESSING
      end
      IB->>PFL: fulfill
      rect rgba(217,70,239,0.22)
        PFL-->>IB: state → PROCESSED
      end
    else accepted (Split, Consumer)
      IB->>PSC: create splits, trigger ExecuteSplitPaymentWF
    else declined
      IB->>PRJ: reject
      rect rgba(217,70,239,0.22)
        PRJ-->>IB: state → REJECTED
      end
    end
  end
```

## 8. Paid Events reconciliation

```mermaid
sequenceDiagram
  autonumber

  box rgba(0,111,207,0.08) Billpay Platform
    participant PPH as Posted Payment Event Handler
    participant MMH as Money Movement Event Handler
    participant TRK as External Transaction Events Tracker
    participant SCH as Paid Events Processor Schedule
    participant PEP as Paid Events Processing WF
  end

  rect rgba(148,163,184,0.08)
    Note over PPH,TRK: Async event ingestion — AR-Posted and Settled events arrive independently
    Note over PPH: receives AR Posted event
    PPH->>TRK: insert AR-Posted row
    Note over MMH: receives Settled event
    MMH->>TRK: insert Settled row
  end

  rect rgba(0,111,207,0.15)
    Note over SCH,PEP: Batch Worker · #PaidEventsProcessingWF — closes the payment to PAID once both events have arrived
    SCH->>PEP: tick (continuous batch)
    PEP->>TRK: find pairs (AR-Posted + Settled)
    PEP->>TRK: mark Picked-up-for-processing
    rect rgba(217,70,239,0.22)
      Note over PEP: state → PAID (insert lifecycle event, update status, publish PAID lifecycle event)
    end
  end
```

## 9. Missing Paid Events reconciliation

```mermaid
sequenceDiagram
  autonumber

  box rgba(0,111,207,0.08) Billpay Platform
    participant SCH as Missing Paid Events Processor Schedule
    participant MPE as Missing Paid Events Processing WF
    participant TRK as External Transaction Events Tracker
  end

  rect rgba(0,111,207,0.15)
    Note over SCH,TRK: Batch Worker · #MissingPaidEventsProcessingWF — hourly probe for AR-Posted or Settled events missing &gt; 48h
    SCH->>MPE: tick (hourly / configurable)
    MPE->>TRK: find payments missing AR-Posted or Settled > 48h
  end

  alt missing AR-Posted
    Note over MPE: probe Accounts Receivable for posted-event status
    alt found
      MPE->>TRK: insert AR-Posted row
    else still missing
      Note over MPE: raise alert
    end
  end
  alt missing Settlement
    Note over MPE: probe Clearing for settlement status
    alt found
      MPE->>TRK: insert Settled row
    else still missing
      Note over MPE: raise alert
    end
  end
```

## 10. Create Payment + Installments (composite)

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Caller
    participant C as Client
    participant ODF as CreatePaymentInstallment.v1
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as POST /paymentInstallments
    participant CWF as Create Payment Installment WF (Composite)
    participant CIP as Create Immediate Payment WF
  end

  C->>ODF: CreatePaymentInstallment.v1
  ODF->>API: POST /paymentInstallments
  API->>CWF: invoke composite

  rect rgba(0,111,207,0.15)
    Note over CWF,CIP: Realtime Worker · #CreatePaymentInstallmentWF — composite that chains payment + installment plan + optional autopay

    rect rgba(0,111,207,0.18)
      CWF->>CIP: invoke CreateImmediatePaymentWF
      rect rgba(217,70,239,0.22)
        CIP-->>CWF: payment-id (state → ACCEPTED)
      end
    end

    Note over CWF: call Installments API to create installment plan, receive installment-id
    opt autopay flag
      Note over CWF: call Autopay API to update autopay
    end
  end

  Note over C,CWF: Client receives 201 ACCEPTED with payment-id + installment-id — payment fulfillment continues inside the child workflow
  CWF-->>API: success
  API-->>ODF: 201 Created
  ODF-->>C: payment-id + installment-id (status=ACCEPTED)
```
