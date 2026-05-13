---
id: composite
title: Composite Workflows
sidebar_position: 2
---

# Composite Workflows

Composite workflows orchestrate **multiple core workflows together** so that a
single business intent (e.g. "create a payment and its installment plan") can
be expressed atomically.

All composite workflows run on the **Realtime Worker**.

## 1. Create Payment & Installments

Triggered by `POST /paymentInstallments`.

**Steps**

1. Execute child `#CreateImmediatePaymentWF`
2. Call the **Installments API** with the resulting payment-id
3. *(optional)* Call the **Update Autopay** API

```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant API as Billpay Core API
  participant CWF as #CreatePaymentInstallment.v1 (composite)
  participant CIP as #CreateImmediatePaymentWF
  participant INST as Installments API
  participant AUTO as Autopay API

  Client->>API: POST /paymentInstallments
  API->>CWF: invoke composite workflow
  CWF->>CIP: child workflow
  CIP-->>CWF: payment-id (PROCESSED)
  CWF->>INST: create installment plan
  INST-->>CWF: OK
  alt autopay flag = true
    CWF->>AUTO: update autopay
    AUTO-->>CWF: OK
  end
  CWF-->>API: success
  API-->>Client: 201 Created
```

## 2. Create Payment with Multiple Instructions

Triggered when `POST /payments` carries **multiple instructions** in a single
request — for example, paying different amounts to several accounts in one shot.

**Steps**

1. Validate the composite payment as a whole
2. For each instruction → invoke a separate `#CreateImmediatePaymentWF`

```mermaid
flowchart LR
  CR[POST /payments with N instructions] --> V[Validate composite payment]
  V --> A[Spawn #CreateImmediatePaymentWF #1]
  V --> B[Spawn #CreateImmediatePaymentWF #2]
  V --> C[Spawn #CreateImmediatePaymentWF #N]
```

Each child workflow runs independently — partial successes are surfaced back to
the caller per-instruction.
