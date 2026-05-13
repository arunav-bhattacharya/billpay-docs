---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_position: 2
---

# Sequence Diagrams

End-to-end traces from a caller's perspective. Each diagram covers a complete
Billpay flow — **One-Data function → Core API → Router → Workflows →
Services → External systems**.

## 1. Immediate payment — single instruction

`CreatePayment.v3` → `POST /payments` (today, single instruction) →
`#CreateImmediatePaymentWF`.

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant ODF as CreatePayment.v3
  participant API as POST /payments
  participant R as Billpay Router
  participant WF as #CreateImmediatePaymentWF (Realtime)
  participant SVC as Payment Services
  participant CL as Clearing
  participant AR as Accounts Receivable
  participant AUTH as Authorization (OTB)
  participant ACC as Accounting
  participant BC as Balance & Control
  participant COM as Communications

  C->>ODF: CreatePayment.v3 (date=today, single)
  ODF->>API: POST /payments
  API->>R: route(date=today, single)
  R->>WF: invoke(workflow-key)

  WF->>SVC: NewPaymentIdempotencyService
  SVC-->>WF: PENDING
  WF->>SVC: PaymentValidationOnExecuteService
  SVC-->>WF: ACCEPTED

  Note over C,WF: ✅ Respond to client at ACCEPTED — fulfillment continues asynchronously
  WF-->>API: success(payment-id, ACCEPTED)
  API-->>ODF: 201 Created
  ODF-->>C: payment-id, status=ACCEPTED

  Note over WF,COM: ⤵ async — happens after the client has been responded to

  par Clearing & Posting in parallel
    WF->>SVC: PaymentExecutionService
    SVC->>CL: send to clearing
    SVC->>AR: decrement balance
    SVC->>AUTH: increase OTB
  end
  SVC-->>WF: PROCESSING

  par Fulfillment fanout
    WF->>SVC: PaymentFulfillmentService
    SVC->>ACC: notify accounting
    SVC->>BC: notify B&C
    SVC->>COM: notify communications
  end
  SVC-->>WF: PROCESSED
```

## 2. Scheduled payment — created today, executed later

`CreatePayment.v3` → `POST /payments` (future date) →
`#CreateSchedulePaymentWF` → later → `#ExecuteScheduledPaymentWF`.

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant API as POST /payments
  participant R as Billpay Router
  participant CSP as #CreateSchedulePaymentWF (Realtime)
  participant SCH as Scheduled Payment Executor
  participant ESP as #ExecuteScheduledPaymentWF (Batch)
  participant SVC as Payment Services
  participant EXT as External Systems

  C->>API: POST /payments (date=future)
  API->>R: route(date=future)
  R->>CSP: invoke(workflow-key)
  CSP->>SVC: NewPaymentIdempotencyService → PENDING
  CSP->>SVC: PaymentValidationOnSchedulingService → SCHEDULED
  CSP->>SVC: PaymentScheduledNotificationService
  CSP-->>API: SCHEDULED
  API-->>C: 201 Created (SCHEDULED)

  Note over SCH,ESP: ⏰ on payment date — schedule fires

  SCH->>ESP: pick up SCHEDULED payments (batches of 2,500/min)
  ESP->>SVC: PaymentValidationOnExecutionService → ACCEPTED
  ESP->>SVC: PaymentExecutionService → PROCESSING
  SVC->>EXT: Clearing / AR / OTB in parallel
  ESP->>SVC: PaymentFulfillmentService → PROCESSED
  SVC->>EXT: Accounting / B&C / Communications

  Note over ESP: PAID is reached separately by the<br/>Paid Events Processor reconciliation
```

## 3. Corporate payment with allocations

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant API as POST /payments
  participant R as Billpay Router
  participant P as Parent WF<br/>#CreateImmediatePaymentWF or<br/>#CreateSchedulePaymentWF
  participant GPA as #GetCorporatePaymentAllocationsWF (Batch)
  participant ESP as #ExecuteSplitPaymentWF (Batch)
  participant GPAext as GPA (External)
  participant SVC as Payment Services
  participant EXT as External Systems

  C->>API: POST /payments (corporate)
  API->>R: route
  R->>P: invoke
  P->>SVC: NewPaymentIdempotencyService → PENDING
  P->>SVC: validate → ACCEPTED / SCHEDULED

  Note over C,P: ✅ Respond to client at ACCEPTED or SCHEDULED — allocations and splits run asynchronously
  P-->>API: success(payment-id, ACCEPTED or SCHEDULED)
  API-->>C: 201 Created

  Note over P,EXT: ⤵ async — happens after the client has been responded to

  P->>GPA: trigger #GetCorporatePaymentAllocationsWF
  GPA->>SVC: AllocationsRequestService → ALLOCATIONS_REQUESTED
  SVC->>GPAext: request allocation breakdown
  GPAext-->>SVC: allocations payload
  GPA->>SVC: AllocationsReceivedService + PaymentSplitsCreationService → ALLOCATIONS_RECEIVED

  GPA->>ESP: trigger #ExecuteSplitPaymentWF (per split, via Corporate Allocations Processor Schedule)
  ESP->>SVC: PaymentExecutionService (split) → PROCESSING
  SVC->>EXT: Clearing / AR / OTB per split
  ESP->>SVC: PaymentFulfillmentService (split) → PROCESSED
  SVC->>EXT: Accounting / B&C / Communications
```

## 4. Update a scheduled payment

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant API as PUT /payments/{id}
  participant U as #UpdatePaymentWF (Realtime)
  participant CAN as #CancelPaymentWF
  participant CSP as #CreateSchedulePaymentWF
  participant SVC as Payment Services

  C->>API: PUT /payments/{id}
  API->>U: invoke
  U->>SVC: ExistingPaymentIdempotencyService → PENDING
  U->>CAN: child workflow (cancel original)
  CAN->>SVC: PaymentCancelValidationService
  CAN->>SVC: PaymentCancellationService → CANCELLED
  CAN-->>U: cancelled
  U->>CSP: child workflow (create replacement)
  CSP-->>U: new payment-id (SCHEDULED or DECLINED)
  U->>SVC: MapNewPaymentIdToPreviousIdService
  U-->>API: success(new payment-id)
  API-->>C: 200 OK
```

## 5. Cancel a payment

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant API as DELETE /payments/{id}
  participant CWF as #CancelPaymentWF
  participant SVC as Payment Services
  participant EXT as External Systems

  C->>API: DELETE /payments/{id}
  API->>CWF: invoke
  CWF->>SVC: ExistingPaymentIdempotencyService
  CWF->>SVC: PaymentCancelValidationService
  alt eligible
    CWF->>SVC: PaymentCancellationService → CANCELLED
    SVC->>EXT: notify
    CWF-->>API: CANCELLED
  else not eligible
    CWF-->>API: error
  end
  API-->>C: response
```

## 6. Return processing (with representment branch)

```mermaid
sequenceDiagram
  autonumber
  participant MM as Money Movement (MR/M3)
  participant MMH as Money Movement Event Handler
  participant API as POST /payments/returns
  participant PR as #ProcessReturnedPaymentWF (Batch)
  participant PRP as #ProcessRepresentmentWF (Batch)
  participant SVC as Payment Services
  participant EXT as External Systems

  MM->>MMH: return event
  MMH->>API: POST /payments/returns
  API->>PR: invoke
  PR->>SVC: ExistingPaymentIdempotencyService
  PR->>SVC: PaymentReturnValidationService
  alt valid return
    PR->>SVC: PaymentReturnExecutionService → RETURNED
    SVC->>EXT: notify
    PR->>SVC: PaymentRepresentmentEligibilityService
    alt representable
      PR->>SVC: PaymentRepresentmentCreationService → REPRESENTING
      PR->>PRP: hand off
      PRP->>SVC: PaymentRepresentmentValidationService
      alt valid representment
        PRP->>SVC: PaymentRepresentmentExecutionService → REPRESENTED
        SVC->>EXT: clearing + notifications
      else invalid
        PRP->>SVC: state-transition → DECLINED
      end
    end
  end
```

## 7. Inbound payment

```mermaid
sequenceDiagram
  autonumber
  participant BG as Batch Gateway
  participant UPH as Unstructured Payment Handler
  participant API as POST /payments/inbound
  participant IB as #ProcessInboundPaymentWF (Batch)
  participant SVC as Payment Services
  participant EXT as External Systems

  BG->>UPH: payment event
  UPH->>UPH: enrich payload
  UPH->>API: POST /payments/inbound
  API->>IB: invoke
  IB->>SVC: NewPaymentIdempotencyService → PENDING
  IB->>SVC: PaymentValidationOnPostingService
  alt accepted (Full)
    IB->>SVC: PaymentPostingService → PROCESSING
    SVC->>EXT: AR + OTB
    IB->>SVC: PaymentFulfillmentService → PROCESSED
    SVC->>EXT: Accounting / B&C / Comms
  else accepted (Split, Consumer)
    IB->>SVC: PaymentSplitsCreationService → trigger #ExecuteSplitPaymentWF
  else declined
    IB->>SVC: PaymentRejectionService → REJECTED
  end
```

## 8. Paid Events reconciliation

```mermaid
sequenceDiagram
  autonumber
  participant AR as Accounts Receivable
  participant CL as Clearing Settlement
  participant PPH as Posted Payment Event Handler
  participant MMH as Money Movement Event Handler
  participant TRK as External Transaction Events Tracker
  participant SCH as Paid Events Processor schedule
  participant PEP as #PaidEventsProcessingWF (Batch)
  participant DB as Billpay DB
  participant BUS as Lifecycle Event Bus

  AR->>PPH: AR Posted event
  PPH->>TRK: insert AR-Posted row

  CL->>MMH: Settled event
  MMH->>TRK: insert Settled row

  SCH->>PEP: tick (continuous batch)
  PEP->>TRK: find pairs (AR-Posted + Settled)
  PEP->>TRK: mark Picked-up-for-processing
  PEP->>DB: insert trans_lfcyc_event (PAID)
  PEP->>DB: update trans_dtl.status = PAID
  PEP->>BUS: publish PAID lifecycle event
```

## 9. Missing Paid Events reconciliation

```mermaid
sequenceDiagram
  autonumber
  participant SCH as Missing Paid Events Processor schedule
  participant MPE as #MissingPaidEventsProcessingWF
  participant TRK as External Transaction Events Tracker
  participant AR as AR system
  participant CL as Clearing system
  participant ALERT as Alerting

  SCH->>MPE: tick (hourly / configurable)
  MPE->>TRK: find payments missing AR-Posted or Settled > 48h
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
  participant C as Client
  participant ODF as CreatePaymentInstallment.v1
  participant API as POST /paymentInstallments
  participant CWF as Composite Workflow
  participant CIP as #CreateImmediatePaymentWF
  participant INST as Installments API
  participant AUTO as Autopay API

  C->>ODF: CreatePaymentInstallment.v1
  ODF->>API: POST /paymentInstallments
  API->>CWF: invoke composite
  CWF->>CIP: child workflow
  CIP-->>CWF: payment-id (ACCEPTED)
  CWF->>INST: create installment plan
  INST-->>CWF: installment-id
  opt autopay flag
    CWF->>AUTO: update autopay
    AUTO-->>CWF: OK
  end

  Note over C,CWF: ✅ Respond to client at ACCEPTED — payment fulfillment continues asynchronously inside CIP
  CWF-->>API: success
  API-->>ODF: 201 Created
  ODF-->>C: payment-id + installment-id (status=ACCEPTED)
```
