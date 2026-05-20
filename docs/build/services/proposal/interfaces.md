---
title: Interfaces
sidebar_position: 2
---

# Service Interfaces

**Interfaces fix the variance contract; implementations honour it.** Every Payment Service is a Kotlin interface that declares — explicitly, with an annotation — which variance axes its implementations may bind to. Implementations then declare their tuple. The pairing is checked at build time.

This page covers what an author writes. The runtime behaviour is on [Strategies](./strategies.md); the build-time machinery is on [Variant Resolution](./variant-resolution.md).

## Variance axes

The proposal commits to five axes today. The mechanism supports adding more without rework.

| Axis | Type | Values |
| --- | --- | --- |
| `paymentMethod` | closed | `enum PaymentMethod { PUSH, PULL }` |
| `market` | open-ended | ISO-3166 alpha-2 (`GB`, `US`, `MX`, …) — modelled as `@JvmInline value class Market(val iso2: String)` |
| `accountType` | closed | `enum AccountType { CONSUMER, CORPORATE }` |
| `frequency` | closed | `enum Frequency { IMMEDIATE, SCHEDULED, RECURRING }` |
| `paymentState` | closed | `enum PaymentState { PENDING, SCHEDULED, ALLOCATIONS_RECEIVED, … }` (the canonical lifecycle states from [the state model](../../../design/payment-state-model.md)) |

These types live in a new `:variance-core` module so neither `:service-api` nor any `:service-impl-*` depends on the other.

## `@VariesOn` — declare the axes on the interface

A service interface advertises which axes its implementations may bind to. `Generic` services omit `@VariesOn`.

```kotlin
package com.amex.billpay.service.validation

import com.amex.billpay.variance.*

@VariesOn(
    VarianceAxis.PAYMENT_METHOD,
    VarianceAxis.MARKET,
    VarianceAxis.ACCOUNT_TYPE,
    VarianceAxis.FREQUENCY,
    VarianceAxis.PAYMENT_STATE,
)
interface PaymentValidationService {
    suspend fun validate(
        ctx: PaymentContext,
        payload: PaymentPayload,
    ): Either<ValidationFailure, ValidatedPaymentResult>
}
```

Other shapes, matching the [services design reference](../../../design/services.md):

```kotlin
// Generic — no @VariesOn
interface PaymentStateTransitionService { /* … */ }

@VariesOn(VarianceAxis.MARKET)
interface PaymentClearingService { /* … */ }

@VariesOn(VarianceAxis.ACCOUNT_TYPE, VarianceAxis.MARKET)
interface PaymentPostingService { /* … */ }
```

:::tip
The `@VariesOn` set is the contract. Adding an axis to an existing interface is a **breaking change** for every existing implementation — the build will fail for impls that don't declare a value on the new axis until they are updated.
:::

## `@PaymentVariant` — declare the tuple on the implementation

Each implementation annotates itself with the values it binds to. Whatever the interface lists in `@VariesOn`, the impl may bind any **subset** — leaving an axis unbound makes the impl a fallback for any value of that axis.

```kotlin
package com.amex.billpay.service.validation.impl.uk

import com.amex.billpay.variance.*
import jakarta.enterprise.context.ApplicationScoped

@ApplicationScoped
@PaymentVariant(
    paymentMethod  = PaymentMethod.PUSH,
    market         = "GB",
    accountType    = AccountType.CONSUMER,
    frequency      = Frequency.RECURRING,
    paymentState   = PaymentState.PENDING,
)
class PaymentValidationServiceUKConsumerRecurringPendingPushImpl(
    private val cutoffs: UkCutoffsRepository,
    private val recurringRules: RecurringRuleSet,
) : PaymentValidationService {
    override suspend fun validate(ctx: PaymentContext, payload: PaymentPayload) =
        either { /* UK Consumer Recurring Pending Push rules */ }
}
```

The annotation is the **source of truth** for routing. The class name (`…UKConsumerRecurringPendingPushImpl`) is documentation — useful for stack traces and code review — and a [Konsist](https://docs.konsist.lemonappdev.com/) test enforces that the suffix matches the annotation.

## The `Generic` fallback

A service may declare a single fallback implementation that wins when no more-specific impl matches:

```kotlin
@ApplicationScoped
@PaymentVariant(generic = true)
class RuleBasedPaymentValidationService(/* … */) : PaymentValidationService { /* … */ }
```

If no `generic = true` impl exists and no tuple matches, the resolver throws `NoVariantImplFoundException`. See [Strategies › Failure modes](./strategies.md#failure-modes) for why this is deliberate.

## Module layout

| Module | Purpose | Depends on |
| --- | --- | --- |
| `:domain-model` *(existing)* | The hardened `Payment` sealed hierarchy, state types, money/id value classes | — |
| `:variance-core` *(new)* | `PaymentContext`, axes, annotations, `PaymentPayload`, `WorkflowScratchpad`, `ServiceResult` marker | — |
| `:service-api` *(existing)* | Service interfaces + `@VariesOn` + per-service `ServiceResult` subtypes | `:variance-core`, `:domain-model` |
| `:validation-rules` / `:execution-rules` *(new)* | Atomic `ValidationRule` / `ExecutionStep` beans, reusable across variants | `:variance-core`, `:service-api` |
| `:service-impl-<market>-<accountType>` *(new, ~24 total)* | Per-family rulebooks and custom impls | `:service-api`, `:validation-rules` |
| `:realtime-worker-app`, `:batch-worker-app` *(existing)* | Deployables; depend on the impls they need and run KSP | every impl needed |

### Why per `(market, accountType)`, not per impl class

24 impl modules — one per `(market, accountType)` family — is the sweet spot. A new market is one new module per account-type. Team ownership is clean: per-market teams own their pair of modules; cross-cutting service refactors happen in `:service-api`. Per-impl modules would explode the Gradle graph (22 services × 12 markets × 2 account-types ≈ 528 modules).

## Naming convention

`PaymentXxxService` — interface and implementations:

- `PaymentValidationService` (interface)
- `PaymentValidationServiceUKConsumerImpl` (`@PaymentVariant(market="GB", accountType=CONSUMER)`)
- `PaymentValidationServiceUKConsumerRecurringPendingPushImpl` (`@PaymentVariant(paymentMethod=PUSH, market="GB", accountType=CONSUMER, frequency=RECURRING, paymentState=PENDING)`)
- `PaymentValidationServiceUSCorporateImpl` (`@PaymentVariant(market="US", accountType=CORPORATE)`)

The suffix is mechanical — it spells out the bound axes in the order: market → account-type → frequency → payment-state → payment-method. A Konsist test enforces it.

## Checklist — adding a new service implementation

- [ ] Decide whether the impl is purely rule-driven (no class needed — just a rulebook, see [Rule Engine](./rule-engine.md#variation-1-pure-rule-based)) or needs custom code.
- [ ] Pick the existing `:service-impl-<market>-<accountType>` module, or create one if the `(market, accountType)` pair is new.
- [ ] If writing a class: name it `Payment<Service><Suffix>Impl`, annotate `@ApplicationScoped` and `@PaymentVariant(...)`. Constructor takes only its own dependencies; the resolver wires itself.
- [ ] If writing a rulebook only: declare a top-level `val …Rulebook = rulebook { … }` annotated `@Rulebook(service, paymentMethod?, market?, accountType?, frequency?, paymentState?)`.
- [ ] Confirm the annotation values match the class-name suffix (Konsist test will fail otherwise).
- [ ] Run `./gradlew build` — KSP will fail the build if your tuple conflicts with an existing impl, if you bind an axis the interface doesn't declare, or if your rulebook references a rule whose `requires` isn't satisfied by the workflow's orchestration plan ([data flow](./data-flow.md#orchestrationlint)).
- [ ] No workflow change. No resolver change. No sidebar of routing config to update.

## Checklist — onboarding a new market

- [ ] Add the market constant to `Market`'s companion (e.g. `val MX = Market("MX")`).
- [ ] Create `:service-impl-mx-consumer` and `:service-impl-mx-corporate` (or only the account-types that apply).
- [ ] For every service whose interface declares `MARKET` in its `@VariesOn`, contribute either a rulebook entry for that market or a custom impl. The release-gate KSP check ([variant-resolution › coverage gate](./variant-resolution.md#coverage-gate)) fails the build artifact if coverage is incomplete.
- [ ] Deploy. Routing picks up automatically.
