---
id: event-handlers
title: Event Handlers
sidebar_position: 4
---

# Event Handlers

Event handlers are **One-Data functions implemented as event consumers**. They
bridge external systems into Billpay's workflows or its
`External Transaction Events Tracker`.

| Handler | Listens to | Effect |
| --- | --- | --- |
| **Money Movement Event Handler** | MR / M3 events | If return → trigger `#ProcessReturnedPaymentWF`; if settled → insert into `External Transaction Events Tracker` |
| **Posted Payment Event Handler** | GAR posted events | Look up the payment; insert into `External Transaction Events Tracker` |
| **Open-To-Buy Update Event Handler** *(TBD)* | AMP events | Insert into `External Transaction Events Tracker` |
| **Unstructured Payment Event Handler** | Batch Gateway events | Enrich the payload; invoke `POST /payments` on Billpay Core |

## Money Movement Event Handler

```mermaid
flowchart LR
  MR[MR / M3 events] --> H[Money Movement Handler]
  H -->|return| RT[POST /payments/returns → #ProcessReturnedPaymentWF]
  H -->|settled| T[Insert into External Transaction Events Tracker]
  T -. waits for AR-Posted .-> PEP[#PaidEventsProcessingWF]
```

## Posted Payment Event Handler

```mermaid
flowchart LR
  GAR[GAR posted events] --> H[Posted Payment Handler]
  H --> L[Lookup payment]
  L --> T[Insert into External Transaction Events Tracker]
  T -. waits for Settlement .-> PEP[#PaidEventsProcessingWF]
```

## Open-To-Buy Update Handler *(TBD)*

```mermaid
flowchart LR
  AMP[AMP events] --> H[OTB Handler]
  H --> T[Insert into External Transaction Events Tracker]
```

The behaviour is still being finalised — the source spec marks this **TBD**.

## Unstructured Payment Event Handler

```mermaid
flowchart LR
  BG[Batch Gateway events] --> H[Unstructured Payment Handler]
  H --> E[Enrich payload]
  E --> POST[Billpay Core POST /payments]
  POST --> WF[Standard Create-Payment workflows]
```

The handler is **the bridge** between low-fidelity, upstream events and the
fully-validated Billpay payment lifecycle. Once it has invoked
`POST /payments`, the request follows the same code path as any inbound
API call.
