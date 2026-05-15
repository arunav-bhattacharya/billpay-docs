---
title: Engineering
sidebar_position: 2
---

# Engineering Vision

> Billpay is a **Temporal-orchestrated, configuration-driven platform**. The engineering challenge: make a system that's correct under failure, easy to evolve per market, and observable enough to operate at Amex scale.

## Core principles

1. **Workflows are the spine; services are the variance.** Each payment lifecycle (immediate / scheduled / recurring; pull / push) is a Temporal Workflow that encodes *what must happen and in what order*. Business-rule variance per market / account / channel lives in **Service implementations** that the workflow calls as activities. New market = new service implementation, not a forked workflow.
2. **Durability over cleverness.** Money movement cannot lose state. Temporal gives us replay-safe history, native retries / timers / signals / queries, and long-running flows as first-class. We don't build bespoke sagas or in-house cron.
3. **One canonical state model.** All payments move through the same states (`PENDING`, `ACCEPTED`, `PROCESSED`, `PAID`, `RETURNED`, `CANCELLED`, …). The state model is the contract between platform and operators.
4. **Contract-versioned entry points.** Public One-Data Functions (e.g. `CreatePayment.v3`) are versioned contracts. Internal refactors do not break channels.
5. **Configuration over deployment.** Per-market parameters (cutoffs, hold windows, retry policies, fee rules) load at runtime. A regulatory change is a config push, not a release.
6. **Realtime where the network allows; batch only where it doesn't.** Legacy balance / OTB / clearing integrations are pushed off cycle-bound batch onto event-driven realtime paths wherever the downstream supports it. Where batch is unavoidable, the boundary is isolated so it doesn't inflate end-to-end latency for the rest of the flow.

## How we run

- **Realtime workers** drive immediate / API-triggered workflows.
- **Batch workers** handle high-volume corporate file flows.
- **Temporal Schedules** drive cron-style executors (settlement sweeps, retry sweeps, recurring-payment triggers).
- **Event handlers** consume async signals (money-movement confirmations, posting events, OTB updates) and feed them back into the right workflow.
- **One-Data Functions** sit at the edge as the gateway to channels.

## What we optimize for

| | |
| --- | --- |
| **Correctness** | Idempotency, deterministic workflows, replay tests. Wrong > slow. |
| **Latency** | Drive payments toward realtime by replacing batch-bound legacy integrations (balance, OTB, clearing) with event-driven paths; isolate any remaining batch hops so they don't taint the end-to-end flow. |
| **Observability** | Every payment must be traceable across One-Data → workflow → activity → downstream, within seconds, from a single surface. |
| **Change safety** | New markets, rules, methods land behind workflow versioning and configuration — not by editing live orchestrations. |
| **Operability** | Operators are first-class users. The platform is designed to be *operated*, not just deployed. |

## What we're explicitly NOT building

- A general-purpose payments engine. Billpay is for **credit-card bill payments**; the abstractions are tuned for that lifecycle.
- A homegrown workflow engine. We use Temporal and stay close to its idioms.
- A new ledger. We integrate with existing card and funding systems of record.
