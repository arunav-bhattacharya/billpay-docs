---
title: Strategies
sidebar_position: 3
---

# Routing Strategy

**Routing is data, not branching.** A workflow holds a `PaymentContext` and a `ServiceResolver<I>`; the resolver does a pure lookup against a build-time-generated index and returns the most-specific implementation for that context. There is no `if (market == "GB") …` in workflow code, and there is no container scan or service-locator lookup on the hot path.

This page covers what happens at runtime. The declarations behind it are on [Interfaces](./interfaces.md); the build-time machinery is on [Variant Resolution](./variant-resolution.md).

## `PaymentContext`

The routing key is a small, immutable value object the workflow constructs once per execution:

```kotlin
@Serializable
data class PaymentContext(
    val market: Market,
    val accountType: AccountType,
    val source: Source,
    val frequency: Frequency,
)
```

It is built from the request at workflow start and is the **only** input the resolver consults. Nothing else — not the time, not the clock, not the worker — affects which implementation gets picked.

## Workflows invoke services directly

The workflow holds an injected resolver for each service it uses and calls `resolver.resolve(ctx).method(...)` inline. **No dispatch activity.** The service runs on the workflow thread; activities used by the service are created via `Workflow.newActivityStub(...)` from inside the service or its rules.

```kotlin
@WorkflowImpl
class CreatePaymentWFImpl(
    private val validationResolver: ServiceResolver<PaymentValidationService>,
    private val stateResolver:      ServiceResolver<PaymentStateTransitionService>,
    /* … one resolver per service the workflow uses … */
) : CreatePaymentWF {

    override fun run(req: CreatePaymentRequest): PaymentResult = runBlocking {
        val ctx = PaymentContext(req.market, req.accountType, req.source, req.frequency)
        var payload = PaymentPayload(payment = PendingPayment.from(req))

        val validated = validationResolver.resolve(ctx)
            .validate(ctx, payload)
            .bindOrDecline(ctx)
        payload = payload.withScratchpad(validated)

        val accepted = stateResolver.resolve(ctx)
            .transition(ctx, payload, to = PaymentState.ACCEPTED)
            .bindOrDecline(ctx)
        payload = payload.withPayment(accepted)

        PaymentResult.ok(payload.payment)
    }
}
```

### Why this is deterministic under Temporal replay

- `ServiceResolver.resolve(ctx)` is a pure lookup over an immutable index. The same `ctx` always returns the same implementation class — no clock, no random, no container scan.
- The resolver itself is injected at worker registration time; the workflow's construction is deterministic.
- I/O still flows through Temporal activities (called from inside the service or rule). Activity results are recorded in the event history and replayed identically.

The full payload-threading walkthrough is on [Data Flow](./data-flow.md#workflow-walkthrough).

## Specificity-based resolution

Every registered tuple gets a **score** computed from which axes it binds. The resolver picks the highest-scoring tuple that matches the context.

| Axis bound | Weight |
| --- | ---: |
| `source` | 8 |
| `frequency` | 4 |
| `accountType` | 2 |
| `market` | 1 |

The weights are powers of two so no two axis combinations can tie. `(market + source)` scores 9; `(market + frequency)` scores 5; `(market + accountType)` scores 3 — distinct, total ordering, no tiebreaker needed.

A `@PaymentVariant(generic = true)` tuple has score `0` and matches any context.

## Worked example — `PaymentValidationService`

Suppose three rulebooks/impls are registered for `PaymentValidationService`:

| Impl / rulebook | Tuple | Score |
| --- | --- | ---: |
| `…UKConsumerImpl` (or `UkConsumerRulebook`) | `(GB, CONSUMER, *, *)` | 3 |
| `…UKConsumerAutopayImpl` (or `UkConsumerAutopayRulebook`) | `(GB, CONSUMER, Autopay, Recurring)` | 15 |
| `…USCorporateImpl` (or `UsCorporateRulebook`) | `(US, CORPORATE, *, *)` | 3 |

### Context A: `(GB, CONSUMER, Autopay, Recurring)`

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(GB, CONSUMER, *, *)` | yes | 3 |
| `(GB, CONSUMER, Autopay, Recurring)` | yes | **15 ◄** |
| `(US, CORPORATE, *, *)` | no (market) | — |

Resolver returns the Autopay-Recurring impl.

### Context B: `(GB, CONSUMER, App, Immediate)`

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(GB, CONSUMER, *, *)` | yes | **3 ◄** |
| `(GB, CONSUMER, Autopay, Recurring)` | no (source) | — |
| `(US, CORPORATE, *, *)` | no (market) | — |

Resolver returns the UK Consumer base impl. **Hierarchical fallback is automatic** — the Autopay tuple didn't match, but the more general one did. No separate fallback table is maintained; the score ordering produces it.

### Context C: `(MX, CONSUMER, App, Immediate)`

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(GB, CONSUMER, *, *)` | no (market) | — |
| `(GB, CONSUMER, Autopay, Recurring)` | no | — |
| `(US, CORPORATE, *, *)` | no | — |

No match, no `generic = true` impl. Resolver throws `NoVariantImplFoundException`. See [Failure modes](#failure-modes) for what happens next.

## Failure modes

### No matching impl

**Hard fail.** The resolver throws `NoVariantImplFoundException(serviceInterface, ctx, registeredTuples)`. The workflow catches it, transitions the payment to `DECLINED` with reason `routing_unsupported` via `PaymentStateTransitionService`, and returns. We deliberately do **not** silently fall back to a Generic impl unless the service interface advertises one. Money movement that silently runs a default validator in an unsupported market is worse than failing loudly.

### Ambiguous match

Cannot happen at runtime — the build fails first. The [KSP processor](./variant-resolution.md#conflict-detection) rejects duplicate tuples for the same interface with a file-pinned diagnostic.

### Missing prerequisite data

A rule that declares `requires = setOf(AllocationsResult::class)` will throw `IllegalStateException` if the workflow hasn't run `PaymentAllocationsRequestService` before validation. This too is caught at build time by [`OrchestrationLint`](./data-flow.md#orchestrationlint) — the build fails naming the rulebook, the rule, and the missing prerequisite.

## Onboarding a new market

To start routing traffic to market `XX`, the deployable must contain — for every service that has `MARKET` in its `@VariesOn` — at least one impl or rulebook binding to `market = "XX"`. A release-gate KSP check enumerates the [services design reference](../../../design/services.md), cross-references the live-market list, and fails the release artifact if any required `(service, market)` pair is missing.

This is documented in detail on [Variant Resolution › Coverage gate](./variant-resolution.md#coverage-gate).

## Per-service migration

The proposal does not require a big-bang switchover. The realtime worker can run a mix of resolver-driven services and bespoke selection logic during rollout:

- Services not yet migrated continue using their existing selection.
- Migrated services get a `ServiceResolver<I>` bean produced by the KSP-generated `ResolverFactory`.
- A workflow can use either path simply by injecting `ServiceResolver<I>` or the legacy selector. No global switch.

Recommended order: **Generic services first** (smallest blast radius — single impl, no routing), then market-only services, then 2-axis, then 3-axis. By the time `PaymentValidationService` (the 4-axis service) is migrated, the resolver and KSP plumbing has been exercised by ~20 simpler services.

:::tip
The flow above intentionally hides the rules and the `PaymentPayload` accumulator to keep the resolution story isolated. For the end-to-end walkthrough of how a single `PaymentValidationService.validate(...)` call composes rules and reads from upstream services, see [Data Flow › Workflow walkthrough](./data-flow.md#workflow-walkthrough).
:::
