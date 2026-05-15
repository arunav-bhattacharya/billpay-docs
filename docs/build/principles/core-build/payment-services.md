---
title: Payment Services
sidebar_position: 2
---

# Payment Services

**Services are the variance.** Where [Temporal Workflows](./temporal-workflows.md) say *what must happen and in what order*, services say *how it happens here* — for this market, this account-type, this origination source.

A service has a single responsibility — validate, transition state, call clearing, fulfil, notify — and is selected at runtime from a pluggable set of implementations.

## Build-time rules

- **One interface per responsibility.** `PaymentValidationService`, `PaymentExecutionService`, `PaymentFulfillmentService`, … Each interface is a `:service-api` module, depended on by workflows. Implementations live in separate `:service-impl-<variant>` modules.
- **Implementations are pluggable.** A `ServiceResolver` selects the right implementation at runtime based on the dimensions documented in the [Payment Services Variance Reason column](../../../design/services.md) — `source/frequency`, `acct-type`, `market`, or any combination.
- **Generic vs. variant.** A service is either `Generic` (one implementation, everywhere) or pluggable on one-or-more variance axes. The variance axes are *fixed by the interface*; adding a new axis is a breaking change.
- **State transitions are paired.** Any service that changes state runs alongside `PaymentStateTransitionService` (or its split-level twin). This pairing is the contract that keeps `trans_dtl`, `trans_lfcyc_event`, and the lifecycle event stream in sync.
- **Idempotency in the implementation.** Service implementations must be safe to retry — Temporal *will* retry activities, and the workflow's history will not protect a service that wrote half-state and threw.

## Naming convention

`PaymentXxxService` — interface and implementations.
- `PaymentValidationService` (interface)
- `PaymentValidationServiceUKConsumerImpl` (implementation)
- `PaymentValidationServiceUSCorporateImpl` (implementation)

The variant suffix on impls is mechanical — it documents the variance axes the impl is selected on.

## Where new market work usually lands

Onboarding a new market = **writing new service implementations**, not editing workflows. If a workflow change is needed to onboard a market, that is a signal that the variance is being modelled at the wrong layer — push back and refactor the service interface first.

:::tip
Before adding a new service, check the [Payment Services reference](../../../design/services.md) — there are 28 services covering most of the lifecycle. The next-best move is often to add a new *implementation* of an existing service, not a new service.
:::
