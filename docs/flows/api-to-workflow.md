---
id: api-to-workflow
title: API → Workflow Mapping
sidebar_position: 1
---

# API → Workflow Mapping

This is the canonical reference for **which workflow handles which API call** —
from One-Data function all the way down to the parent/child workflow tree.

```mermaid
flowchart LR
  ODF["One-Data Function"] --> CORE["Billpay Core API"] --> R["Router"] --> P["Parent Workflow"] --> CH["Child Workflows"]
```

## Mapping table

| One-Data Function | Billpay Core API | Router decisions | Parent Workflow | Child Workflows |
| --- | --- | --- | --- | --- |
| **CreatePayment.v3** | `POST /payments` | `date = today`, single instruction | [`#CreateImmediatePaymentWF`](../workflows/core.md#1-createimmediatepaymentwf) (Realtime) | **Consumer + Split**: [`#ExecuteSplitPaymentWF`](../workflows/core.md#4-executesplitpaymentwf) (Realtime) <br/> **Consumer + Full**: no child <br/> **Corporate**: [`#GetCorporatePaymentAllocationsWF`](../workflows/core.md#9-getcorporatepaymentallocationswf) (Batch) → [`#ExecuteSplitPaymentWF`](../workflows/core.md#4-executesplitpaymentwf) (Batch, via *Corporate Allocations Processor Schedule*) |
| **CreatePayment.v3** | `POST /payments` | `date = today`, **multiple** instructions | `#CreatePaymentWithMultipleInstructionsWF` (Realtime) — see [Composite](../workflows/composite.md) | per-instruction [`#CreateImmediatePaymentWF`](../workflows/core.md#1-createimmediatepaymentwf) |
| **CreatePayment.v3** | `POST /payments` | `date = future`, single instruction | [`#CreateSchedulePaymentWF`](../workflows/core.md#2-createschedulepaymentwf) (Realtime) | **Consumer**: later → [`#ExecuteScheduledPaymentWF`](../workflows/core.md#3-executescheduledpaymentwf) (Batch); if Split → [`#ExecuteSplitPaymentWF`](../workflows/core.md#4-executesplitpaymentwf) (Batch). <br/> **Corporate**: [`#GetCorporatePaymentAllocationsWF`](../workflows/core.md#9-getcorporatepaymentallocationswf) (Batch) **first** → then [`#ExecuteScheduledPaymentWF`](../workflows/core.md#3-executescheduledpaymentwf) (Batch) → [`#ExecuteSplitPaymentWF`](../workflows/core.md#4-executesplitpaymentwf) (Batch, via *Corporate Allocations Processor Schedule*) |
| **UpdatePayment.v1** | `PUT /payments/{id}` | create workflow-key, invoke | [`#UpdatePaymentWF`](../workflows/core.md#6-updatepaymentwf) (Realtime) | [`#CancelPaymentWF`](../workflows/core.md#5-cancelpaymentwf), [`#CreateSchedulePaymentWF`](../workflows/core.md#2-createschedulepaymentwf) |
| **DeletePayment.v1** | `DELETE /payments/{id}` | create workflow-key, invoke | [`#CancelPaymentWF`](../workflows/core.md#5-cancelpaymentwf) (Realtime) | – |
| **MoneyMovementEventListener.v1** | `POST /payments/returns` | create workflow-key, invoke | [`#ProcessReturnedPaymentWF`](../workflows/core.md#7-processreturnedpaymentwf) (Batch) | [`#ProcessRepresentmentWF`](../workflows/core.md#8-processrepresentmentwf) (Batch) |
| **CreateInboundPayment.v1** | `POST /payments/inbound` | create workflow-key, invoke | [`#ProcessInboundPaymentWF`](../workflows/core.md#10-processinboundpaymentwf) (Batch) | – |
| **CreateCreditBalanceRefund.v1** | `POST /refunds` | create workflow-key, invoke | [`#CreateBalanceRefundWF`](../workflows/core.md#11-createbalancerefundwf) | – |
| **CreatePaymentInstallment.v1** | `POST /paymentInstallments` | composite orchestration | [Create Payment & Installments](../workflows/composite.md#1-create-payment--installments) (Realtime) | [`#CreateImmediatePaymentWF`](../workflows/core.md#1-createimmediatepaymentwf), Installments API, Autopay API |

:::tip[Routing rules at a glance]
- **Consumer + Full** stays inside the parent workflow — no split workflow is launched.
- **Consumer + Split** triggers `#ExecuteSplitPaymentWF` (Realtime for immediate, Batch for scheduled).
- **Corporate** always goes through `#GetCorporatePaymentAllocationsWF` first to fetch the allocation breakdown from GPA. Splits are then drained by the **Corporate Allocations Processor Schedule** which triggers `#ExecuteSplitPaymentWF` on the Batch worker in waves.
- **Corporate + Scheduled**: allocations are fetched **before** `#ExecuteScheduledPaymentWF` is invoked — by the time the executor fires, the payment is already in `ALLOCATIONS_RECEIVED`.
:::

## Router decision flow

```mermaid
flowchart TB
  start(["POST /payments arrives"]) --> instr{"Number of instructions?"}
  instr -->|multiple| MULTI["#CreatePaymentWithMultipleInstructionsWF"]
  instr -->|single| date{"payment-date?"}

  date -->|today| imm["#CreateImmediatePaymentWF"]
  date -->|future| sched["#CreateSchedulePaymentWF"]

  %% Immediate branch
  imm --> kind{"Account kind?"}
  kind -->|Consumer| splitQ1{"Split payment?"}
  splitQ1 -->|No| done1["Stay in parent WF<br/>execute · fulfill"]
  splitQ1 -->|Yes| ESP1["#ExecuteSplitPaymentWF<br/>Realtime"]
  kind -->|Corporate| GPA1["#GetCorporatePaymentAllocationsWF<br/>Batch"]
  GPA1 --> CAPS1["Corporate Allocations<br/>Processor Schedule"]
  CAPS1 --> ESP2["#ExecuteSplitPaymentWF<br/>Batch"]

  %% Scheduled branch
  sched --> kind2{"Account kind?"}
  kind2 -->|Corporate| GPA2["#GetCorporatePaymentAllocationsWF<br/>Batch · fetched first"]
  GPA2 --> EXEC2["#ExecuteScheduledPaymentWF<br/>Batch"]
  EXEC2 --> CAPS2["Corporate Allocations<br/>Processor Schedule"]
  CAPS2 --> ESP4["#ExecuteSplitPaymentWF<br/>Batch"]

  kind2 -->|Consumer| EXEC["#ExecuteScheduledPaymentWF<br/>Batch · later"]
  EXEC --> splitQ2{"Split payment?"}
  splitQ2 -->|No| done2["Stay in executor<br/>execute · fulfill"]
  splitQ2 -->|Yes| ESP3["#ExecuteSplitPaymentWF<br/>Batch"]
```
