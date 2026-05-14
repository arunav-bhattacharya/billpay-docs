---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_position: 2
---

# Sequence Diagrams

End-to-end traces from a caller's perspective. Each diagram covers a complete
Billpay flow — **One-Data function → Core API → Router → Workflows →
Services → External systems**.

Two groups appear at the top of every diagram:

- **Caller** — the caller side (soft slate)
- **Billpay Platform** — everything past the contract: Core API, Router, Workflows, Services, and downstream External Systems (light blue)

Inside the body:

- **Blue-tinted rectangles** wrap the messages that belong to a single workflow (the workflow name is labeled at the top of the block).
- **Amber-tinted rectangles** mark async work that happens *after* the client has been responded to.
- **Fuchsia/pink-tinted rectangles** pop out **state transitions** — moments where the payment moves from one lifecycle state to another (`PENDING → ACCEPTED`, `PROCESSING → PROCESSED`, etc.).

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
    participant SVC as Payment Services
    participant CL as Clearing
    participant AR as Accounts Receivable
    participant AUTH as Authorization (OTB)
    participant ACC as Accounting
    participant BC as Balance & Control
    participant COM as Communications
  end

  C->>ODF: CreatePayment.v3 (date=today, single)
  ODF->>API: POST /payments
  API->>R: route(date=today, single)
  R->>WF: invoke(workflow-key)

  rect rgba(0,111,207,0.15)
    Note over WF,SVC: Realtime Worker · #CreateImmediatePaymentWF — validates and accepts inline
    WF->>SVC: NewPaymentIdempotencyService
    rect rgba(217,70,239,0.22)
      SVC-->>WF: state → PENDING
    end
    WF->>SVC: PaymentValidationOnExecuteService
    rect rgba(217,70,239,0.22)
      SVC-->>WF: state → ACCEPTED
    end
  end

  Note over C,WF: Client receives 201 ACCEPTED — payment is durable, fulfillment continues in the background
  WF-->>API: success (payment-id, ACCEPTED)
  API-->>ODF: 201 Created
  ODF-->>C: payment-id, status=ACCEPTED

  rect rgba(245,158,11,0.18)
    Note over WF,COM: Async fulfillment — clearing, posting, accounting and notifications fire after the response
      par Clearing & Posting in parallel
        WF->>SVC: PaymentExecutionService
        SVC->>CL: send to clearing
        SVC->>AR: decrement balance
        SVC->>AUTH: increase OTB
      end
      rect rgba(217,70,239,0.22)
        SVC-->>WF: state → PROCESSING
      end

      par Fulfillment fanout
        WF->>SVC: PaymentFulfillmentService
        SVC->>ACC: notify accounting
        SVC->>BC: notify B&C
        SVC->>COM: notify communications
      end
      rect rgba(217,70,239,0.22)
        SVC-->>WF: state → PROCESSED
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
    participant SCH as Scheduled Payment Executor
    participant ESP as Execute Scheduled Payment WF
    participant SVC as Payment Services
    participant EXT as External Systems
  end

  C->>API: POST /payments (date=future)
  API->>R: route(date=future)
  R->>CSP: invoke(workflow-key)

  rect rgba(0,111,207,0.15)
    Note over CSP,SVC: Realtime Worker · #CreateSchedulePaymentWF — validates the schedule, returns SCHEDULED
    CSP->>SVC: NewPaymentIdempotencyService
    rect rgba(217,70,239,0.22)
      SVC-->>CSP: state → PENDING
    end
    CSP->>SVC: PaymentValidationOnSchedulingService
    rect rgba(217,70,239,0.22)
      SVC-->>CSP: state → SCHEDULED
    end
    CSP->>SVC: PaymentScheduledNotificationService
  end

  CSP-->>API: SCHEDULED
  API-->>C: 201 Created (SCHEDULED)

  Note over SCH,ESP: On payment date · Scheduled Payment Executor fires (waves of 2,500 / minute)

  rect rgba(245,158,11,0.18)
    Note over SCH,EXT: Batch Worker · #ExecuteScheduledPaymentWF — re-validates, executes and fulfills
    SCH->>ESP: pick up SCHEDULED payments (batches of 2,500/min)
    ESP->>SVC: PaymentValidationOnExecutionService
    rect rgba(217,70,239,0.22)
      SVC-->>ESP: state → ACCEPTED
    end
    ESP->>SVC: PaymentExecutionService
    rect rgba(217,70,239,0.22)
      SVC-->>ESP: state → PROCESSING
    end
    SVC->>EXT: Clearing / AR / OTB in parallel
    ESP->>SVC: PaymentFulfillmentService
    rect rgba(217,70,239,0.22)
      SVC-->>ESP: state → PROCESSED
    end
    SVC->>EXT: Accounting / B&C / Communications
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
    participant GPA as Get Corporate Payment Allocations WF
    participant ESP as Execute Split Payment WF
    participant GPAext as GPA Allocations System
    participant SVC as Payment Services
    participant EXT as External Systems
  end

  C->>API: POST /payments (corporate)
  API->>R: route
  R->>P: invoke

  rect rgba(0,111,207,0.15)
    Note over P,SVC: Realtime Worker · parent is either #CreateImmediatePaymentWF or #CreateSchedulePaymentWF
    P->>SVC: NewPaymentIdempotencyService
    rect rgba(217,70,239,0.22)
      SVC-->>P: state → PENDING
    end
    P->>SVC: validate
    rect rgba(217,70,239,0.22)
      SVC-->>P: state → ACCEPTED or SCHEDULED
    end
  end

  Note over C,P: Client receives 201 ACCEPTED or SCHEDULED — allocations and split execution run in the background
  P-->>API: success (payment-id, ACCEPTED or SCHEDULED)
  API-->>C: 201 Created

  rect rgba(245,158,11,0.18)
    Note over P,EXT: Async — corporate allocations are fetched, then per-split execution runs in waves

    rect rgba(0,111,207,0.15)
      Note over GPA,GPAext: Batch Worker · #GetCorporatePaymentAllocationsWF — fetches the split breakdown from GPA
      P->>GPA: trigger allocations workflow
      GPA->>SVC: AllocationsRequestService
      rect rgba(217,70,239,0.22)
        SVC-->>GPA: state → ALLOCATIONS_REQUESTED
      end
      SVC->>GPAext: request allocation breakdown
      GPAext-->>SVC: allocations payload
      GPA->>SVC: AllocationsReceivedService + PaymentSplitsCreationService
      rect rgba(217,70,239,0.22)
        SVC-->>GPA: state → ALLOCATIONS_RECEIVED
      end
    end

    rect rgba(0,111,207,0.15)
      Note over ESP,EXT: Batch Worker · #ExecuteSplitPaymentWF — drained by the Corporate Allocations Processor Schedule
      GPA->>ESP: trigger split execution
      ESP->>SVC: PaymentExecutionService (split)
      rect rgba(217,70,239,0.22)
        SVC-->>ESP: state → PROCESSING
      end
      SVC->>EXT: Clearing / AR / OTB per split
      ESP->>SVC: PaymentFulfillmentService (split)
      rect rgba(217,70,239,0.22)
        SVC-->>ESP: state → PROCESSED
      end
      SVC->>EXT: Accounting / B&C / Communications
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
    participant CAN as Cancel Payment WF
    participant CSP as Create Schedule Payment WF
    participant SVC as Payment Services
  end

  C->>API: PUT /payments/:id
  API->>U: invoke

  rect rgba(0,111,207,0.15)
    Note over U,SVC: Realtime Worker · #UpdatePaymentWF — cancels the original, creates a replacement, maps old → new
    U->>SVC: ExistingPaymentIdempotencyService
    rect rgba(217,70,239,0.22)
      SVC-->>U: state → PENDING
    end

    rect rgba(0,111,207,0.18)
      U->>CAN: cancel original
      CAN->>SVC: PaymentCancelValidationService
      CAN->>SVC: PaymentCancellationService
      rect rgba(217,70,239,0.22)
        SVC-->>CAN: state → CANCELLED
      end
      CAN-->>U: cancelled
    end

    rect rgba(0,111,207,0.18)
      U->>CSP: create replacement
      rect rgba(217,70,239,0.22)
        CSP-->>U: new payment-id (state → SCHEDULED or DECLINED)
      end
    end

    U->>SVC: MapNewPaymentIdToPreviousIdService
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
    participant SVC as Payment Services
    participant EXT as External Systems
  end

  C->>API: DELETE /payments/:id
  API->>CWF: invoke

  rect rgba(0,111,207,0.15)
    Note over CWF,EXT: Realtime Worker · #CancelPaymentWF — checks eligibility, transitions to CANCELLED, notifies externals
    CWF->>SVC: ExistingPaymentIdempotencyService
    CWF->>SVC: PaymentCancelValidationService
    alt eligible
      CWF->>SVC: PaymentCancellationService
      rect rgba(217,70,239,0.22)
        SVC-->>CWF: state → CANCELLED
      end
      SVC->>EXT: notify external systems
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

  box rgba(148,163,184,0.06) Source
    participant MM as Money Movement (MR/M3)
    participant MMH as Money Movement Event Handler
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as POST /payments/returns
    participant PR as Process Returned Payment WF
    participant PRP as Process Representment WF
    participant SVC as Payment Services
    participant EXT as External Systems
  end

  MM->>MMH: return event
  MMH->>API: POST /payments/returns
  API->>PR: invoke

  rect rgba(0,111,207,0.15)
    Note over PR,EXT: Batch Worker · #ProcessReturnedPaymentWF — triggered by Money Movement return events
    PR->>SVC: ExistingPaymentIdempotencyService
    PR->>SVC: PaymentReturnValidationService
    alt valid return
      PR->>SVC: PaymentReturnExecutionService
      rect rgba(217,70,239,0.22)
        SVC-->>PR: state → RETURNED
      end
      SVC->>EXT: notify return
      PR->>SVC: PaymentRepresentmentEligibilityService
      alt representable
        PR->>SVC: PaymentRepresentmentCreationService
        rect rgba(217,70,239,0.22)
          SVC-->>PR: state → REPRESENTING
        end
        PR->>PRP: hand off

        rect rgba(0,111,207,0.18)
          Note over PRP,EXT: Batch Worker · #ProcessRepresentmentWF — re-clears a returned transaction on the representment day
          PRP->>SVC: PaymentRepresentmentValidationService
          alt valid representment
            PRP->>SVC: PaymentRepresentmentExecutionService
            rect rgba(217,70,239,0.22)
              SVC-->>PRP: state → REPRESENTED
            end
            SVC->>EXT: clearing + notifications
          else invalid
            rect rgba(217,70,239,0.22)
              PRP->>SVC: state → DECLINED
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

  box rgba(148,163,184,0.06) Source
    participant BG as Batch Gateway
    participant UPH as Unstructured Payment Handler
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant API as POST /payments/inbound
    participant IB as Process Inbound Payment WF
    participant SVC as Payment Services
    participant EXT as External Systems
  end

  BG->>UPH: payment event
  UPH->>UPH: enrich payload
  UPH->>API: POST /payments/inbound
  API->>IB: invoke

  rect rgba(0,111,207,0.15)
    Note over IB,EXT: Batch Worker · #ProcessInboundPaymentWF — posts an upstream-originated payment into Billpay
    IB->>SVC: NewPaymentIdempotencyService
    rect rgba(217,70,239,0.22)
      SVC-->>IB: state → PENDING
    end
    IB->>SVC: PaymentValidationOnPostingService
    alt accepted (Full)
      IB->>SVC: PaymentPostingService
      rect rgba(217,70,239,0.22)
        SVC-->>IB: state → PROCESSING
      end
      SVC->>EXT: AR + OTB
      IB->>SVC: PaymentFulfillmentService
      rect rgba(217,70,239,0.22)
        SVC-->>IB: state → PROCESSED
      end
      SVC->>EXT: Accounting / B&C / Comms
    else accepted (Split, Consumer)
      IB->>SVC: PaymentSplitsCreationService → trigger ExecuteSplitPaymentWF
    else declined
      IB->>SVC: PaymentRejectionService
      rect rgba(217,70,239,0.22)
        SVC-->>IB: state → REJECTED
      end
    end
  end
```

## 8. Paid Events reconciliation

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Sources
    participant AR as Accounts Receivable
    participant CL as Clearing Settlement
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant PPH as Posted Payment Event Handler
    participant MMH as Money Movement Event Handler
    participant TRK as External Transaction Events Tracker
    participant SCH as Paid Events Processor schedule
    participant PEP as Paid Events Processing WF
    participant DB as Billpay Database
    participant BUS as Lifecycle Event Bus
  end

  rect rgba(148,163,184,0.08)
    Note over AR,TRK: Async event ingestion — AR-Posted and Settled events arrive independently
    AR->>PPH: AR Posted event
    PPH->>TRK: insert AR-Posted row

    CL->>MMH: Settled event
    MMH->>TRK: insert Settled row
  end

  rect rgba(0,111,207,0.15)
    Note over SCH,BUS: Batch Worker · #PaidEventsProcessingWF — closes the payment to PAID once both events have arrived
    SCH->>PEP: tick (continuous batch)
    PEP->>TRK: find pairs (AR-Posted + Settled)
    PEP->>TRK: mark Picked-up-for-processing
    rect rgba(217,70,239,0.22)
      PEP->>DB: state → PAID (insert trans_lfcyc_event)
      PEP->>DB: state → PAID (update trans_dtl.status)
      PEP->>BUS: publish PAID lifecycle event
    end
  end
```

## 9. Missing Paid Events reconciliation

```mermaid
sequenceDiagram
  autonumber

  box rgba(148,163,184,0.06) Upstream
    participant AR as Accounts Receivable
    participant CL as Clearing System
  end

  box rgba(0,111,207,0.08) Billpay Platform
    participant SCH as Missing Paid Events Processor schedule
    participant MPE as Missing Paid Events Processing WF
    participant TRK as External Transaction Events Tracker
    participant ALERT as Alerting
  end

  rect rgba(0,111,207,0.15)
    Note over SCH,ALERT: Batch Worker · #MissingPaidEventsProcessingWF — hourly probe for AR-Posted or Settled events missing &gt; 48h
    SCH->>MPE: tick (hourly / configurable)
    MPE->>TRK: find payments missing AR-Posted or Settled > 48h
  end

  alt missing AR-Posted
    MPE->>AR: query status
    alt found
      AR-->>MPE: posted-event payload
      MPE->>TRK: insert AR-Posted row
    else still missing
      MPE->>ALERT: raise alert
    end
  end
  alt missing Settlement
    MPE->>CL: query status
    alt found
      CL-->>MPE: settlement payload
      MPE->>TRK: insert Settled row
    else still missing
      MPE->>ALERT: raise alert
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
    participant INST as Installments API
    participant AUTO as Autopay API
  end

  C->>ODF: CreatePaymentInstallment.v1
  ODF->>API: POST /paymentInstallments
  API->>CWF: invoke composite

  rect rgba(0,111,207,0.15)
    Note over CWF,AUTO: Realtime Worker · #CreatePaymentInstallmentWF — composite that chains payment + installment plan + optional autopay

    rect rgba(0,111,207,0.18)
      CWF->>CIP: invoke CreateImmediatePaymentWF
      rect rgba(217,70,239,0.22)
        CIP-->>CWF: payment-id (state → ACCEPTED)
      end
    end

    CWF->>INST: create installment plan
    INST-->>CWF: installment-id
    opt autopay flag
      CWF->>AUTO: update autopay
      AUTO-->>CWF: OK
    end
  end

  Note over C,CWF: Client receives 201 ACCEPTED with payment-id + installment-id — payment fulfillment continues inside the child workflow
  CWF-->>API: success
  API-->>ODF: 201 Created
  ODF-->>C: payment-id + installment-id (status=ACCEPTED)
```
