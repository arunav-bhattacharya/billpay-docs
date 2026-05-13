---
id: overview
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

Billpay is layered so each tier has **one responsibility** and can evolve
independently. A request flows top-to-bottom through these layers — and async
events loop back through the Event Handlers on the right.

<div className="bp-arch">

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">01</span>
      <div>
        <h4>Clients & Upstream</h4>
        <p>Origin of every request and async event</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Channels / UI</span>
      <span className="bp-arch__item">Batch Gateway</span>
      <span className="bp-arch__item">RTF</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer bp-arch__layer--accent">
    <div className="bp-arch__head">
      <span className="bp-arch__num">02</span>
      <div>
        <h4>One-Data Functions</h4>
        <p>Versioned, contract-level entrypoints</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">CreatePayment.v3</span>
      <span className="bp-arch__item">UpdatePayment.v1</span>
      <span className="bp-arch__item">DeletePayment.v1</span>
      <span className="bp-arch__item">ReadPayments.v1</span>
      <span className="bp-arch__item">CreateCreditBalanceRefund.v1</span>
      <span className="bp-arch__item">CreatePaymentInstallment.v1</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">03</span>
      <div>
        <h4>Billpay Core APIs</h4>
        <p>REST surface — request shaping, idempotency</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item bp-arch__item--code">POST /payments</span>
      <span className="bp-arch__item bp-arch__item--code">PUT /payments/:id</span>
      <span className="bp-arch__item bp-arch__item--code">DELETE /payments/:id</span>
      <span className="bp-arch__item bp-arch__item--code">POST /payments/returns</span>
      <span className="bp-arch__item bp-arch__item--code">POST /payments/inbound</span>
      <span className="bp-arch__item bp-arch__item--code">POST /refunds</span>
      <span className="bp-arch__item bp-arch__item--code">GET /payments/:id</span>
      <span className="bp-arch__item bp-arch__item--code">POST /paymentInstallments</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer bp-arch__layer--accent">
    <div className="bp-arch__head">
      <span className="bp-arch__num">04</span>
      <div>
        <h4>Billpay Router</h4>
        <p>Chooses the workflow · mints the workflow-key</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">date routing</span>
      <span className="bp-arch__item">single / multi instruction</span>
      <span className="bp-arch__item">Consumer / Corporate</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">05</span>
      <div>
        <h4>Temporal Workflows</h4>
        <p>Durable orchestration · realtime + batch + scheduled</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Realtime Worker</span>
      <span className="bp-arch__item">Batch Worker</span>
      <span className="bp-arch__item">Scheduled (Temporal Schedules)</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer bp-arch__layer--accent">
    <div className="bp-arch__head">
      <span className="bp-arch__num">06</span>
      <div>
        <h4>Payment Services</h4>
        <p>Single-responsibility activities composed by workflows</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Validation</span>
      <span className="bp-arch__item">State transitions</span>
      <span className="bp-arch__item">Clearing · Posting · Fulfillment</span>
      <span className="bp-arch__item">Notifications</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">07</span>
      <div>
        <h4>External Systems</h4>
        <p>Side-effect destinations</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Clearing</span>
      <span className="bp-arch__item">Accounts Receivable</span>
      <span className="bp-arch__item">Authorization · OTB</span>
      <span className="bp-arch__item">Accounting</span>
      <span className="bp-arch__item">Balance & Control</span>
      <span className="bp-arch__item">Communications</span>
      <span className="bp-arch__item">GPA · Allocations</span>
    </div>
  </div>

</div>

<div className="bp-arch__side">
  <div className="bp-arch__side-label">async events loop back through</div>
  <div className="bp-arch__layer bp-arch__layer--side">
    <div className="bp-arch__head">
      <span className="bp-arch__num bp-arch__num--side">⤴</span>
      <div>
        <h4>Event Handlers</h4>
        <p>One-Data functions that consume async events</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Money Movement</span>
      <span className="bp-arch__item">Posted Payment</span>
      <span className="bp-arch__item">OTB Update</span>
      <span className="bp-arch__item">Unstructured Payment</span>
    </div>
  </div>
</div>

## Layer responsibilities

### 1. One-Data Functions
The **contract-level** layer that external callers integrate with. These
functions are versioned and stable. Internally they delegate to the Billpay
Core APIs.

### 2. Billpay Core APIs
REST endpoints owned by the Billpay service. They perform request shaping,
permission/idempotency checks, and hand off to the Router.

### 3. Billpay Router
A thin orchestrator that decides **which workflow to invoke** based on:

- The payment date (current → immediate; future → scheduled)
- Single vs. multiple instructions (composite payment)
- The kind of request (create, update, cancel, return, inbound)

It also **mints the workflow key** used for Temporal idempotency.

### 4. Temporal Workflows
The durable orchestration engine. Two worker types:

| Worker | Purpose | Examples |
| --- | --- | --- |
| **Realtime** | Triggered by an end-user request that awaits a response | `#CreateImmediatePaymentWF`, `#UpdatePaymentWF`, `#CancelPaymentWF` |
| **Batch** | Triggered asynchronously by events or schedules | `#ExecuteScheduledPaymentWF`, `#ProcessReturnedPaymentWF`, `#ProcessInboundPaymentWF` |

A workflow is composed of **services** (Temporal activities) that perform
state transitions or call external systems.

### 5. Payment Services
The **reusable** building blocks. A service does exactly one job: validate,
transition state, call clearing, fulfill, notify, etc. Services are designed
to be composed across workflows, with **variations** chosen per source,
account-type or market. See the
[Payment Services reference](../services/payment-services.md) for the full list.

### 6. Event Handlers
Event-driven One-Data functions that bridge external systems back into
Billpay's workflows or its `External Transaction Events Tracker`. They turn
async events into either workflow triggers or state-transition records.

### 7. Schedules
Temporal Schedules that fire batch workflows in waves (e.g. 2,500 scheduled
payments / minute), plus reconciliation jobs that close out partial-event
scenarios.

## Persistence model

Three tables back every payment:

- **`trans_dtl`** — the current state of each payment.
- **`trans_lfcyc_event`** — append-only lifecycle event log per payment.
- **`split_trans_dtl` + `split_trans_lfcyc_event`** — same pair, but for split-level transactions.
- **`idempotency_checker`** — guards duplicate requests at the API boundary.
- **`External Transaction Events Tracker`** — tracks Clearing/Settlement and AR-Posted events so the **Paid Events Processor** can close out a payment.
- **`ORIG_TRANS_REFER_MAP`** — maps a replacement payment back to the original (used by `#UpdatePaymentWF`).
- **`notification_tracker`** — durable record of every external notification we owe.

Move to [Components](components.md) for a deeper look at each block, or jump
straight to the [State Model](state-model.md) to see how a payment evolves.
