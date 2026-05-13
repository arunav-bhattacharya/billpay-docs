---
id: intro
title: Introduction
sidebar_position: 1
slug: /intro
---

# Welcome to Billpay Platform Docs

Billpay is the platform that **orchestrates payment lifecycles** — from the moment
a customer (or upstream system) initiates a payment, through validation,
clearing, posting and fulfillment, all the way to terminal states like `PAID`,
`RETURNED` or `CANCELLED`.

This site captures every moving part of that journey:

| Layer | What it is | Where to read |
| --- | --- | --- |
| **One-Data Functions** | The public, contract-level entry-points (e.g. `CreatePayment.v3`) | [One-Data Functions](apis/one-data-functions.md) |
| **Billpay Core APIs** | REST endpoints exposed by Billpay-core (`POST /payments`, …) | [Billpay APIs](apis/billpay-apis.md) |
| **Billpay Router** | Lightweight routing layer that picks the right workflow | [Architecture › Components](architecture/components.md) |
| **Temporal Workflows** | Long-running, durable orchestrations (realtime + batch) | [Workflows › Core](workflows/core.md) |
| **Payment Services** | Re-usable activities that change state, call externals, notify | [Payment Services](services/payment-services.md) |
| **Event Handlers** | Async consumers of money-movement / posted / OTB events | [Event Handlers](workflows/event-handlers.md) |
| **Schedules** | Temporal Schedules that drive cron-style batch executors | [Scheduled Workflows](workflows/scheduled.md) |

## How to read these docs

- **For product.** Start with the [Architecture Overview](architecture/overview.md)
  and the [State Diagrams](diagrams/state-diagrams.md). Together they give you a
  full mental model in under 10 minutes.
- **For engineers.** Start with the [API → Workflow mapping](flows/api-to-workflow.md)
  for an end-to-end view, then drill into individual
  [Workflows](workflows/core.md) and the
  [Payment Services](services/payment-services.md) reference.
- **For operators.** [Schedules](workflows/scheduled.md) and the
  [Event Handlers](workflows/event-handlers.md) page describe the cron and event-driven
  surfaces you'll be monitoring.

## Conventions

- States are written in `UPPER_SNAKE_CASE` — e.g. `PENDING`, `ACCEPTED`, `PROCESSED`.
- Workflow names use the `#NameWF` hashtag style: `#CreateImmediatePaymentWF`.
- Service names end in `Service`: `PaymentValidationOnExecutionService`.
- All diagrams on this site are written in [Mermaid](https://mermaid.js.org/) and
  render natively — you can copy them straight into Confluence or another Mermaid host.

:::tip
Every page on this site is markdown + Mermaid only. You can drop new diagrams,
flows or services in via PR without touching React.
:::
