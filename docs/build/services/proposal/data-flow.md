---
title: Data Flow
sidebar_position: 4
---

# Data Flow

**Domain Model and workflow scratchpad are two different things, and the type system enforces it.** The hardened `Payment` domain model carries only fields relevant for processing and persistence — what `trans_dtl` / `trans_lfcyc_event` already store. Intermediate service outputs that *help the workflow proceed* but are not part of the audit trail (allocations snapshot id, customer360 risk score, OTB headroom, clearing trace id) live in a **`WorkflowScratchpad`** that is never persisted and is discarded at workflow completion.

This page is the contract for how services exchange data without leaking workflow-only state into the domain.

## The two halves of `PaymentPayload`

```kotlin
package com.amex.billpay.variance

// Marker — types that live in the scratchpad only. NEVER a Payment field.
sealed interface ServiceResult

@Serializable
data class WorkflowScratchpad(
    private val results: PersistentMap<KClass<out ServiceResult>, ServiceResult> = persistentMapOf(),
) {
    inline fun <reified T : ServiceResult> require(): T =
        results[T::class] as? T
            ?: error("WorkflowScratchpad missing required ${T::class.simpleName}; check orchestration order")

    inline fun <reified T : ServiceResult> optional(): T? = results[T::class] as? T

    fun with(result: ServiceResult): WorkflowScratchpad =
        copy(results = results.put(result::class, result))
}

@Serializable
data class PaymentPayload(
    val payment:    Payment,                             // hardened Domain Model from :domain-model
    val scratchpad: WorkflowScratchpad = WorkflowScratchpad(),
) {
    inline fun <reified T : ServiceResult> require(): T = scratchpad.require()
    inline fun <reified T : ServiceResult> optional(): T? = scratchpad.optional()

    fun withScratchpad(result: ServiceResult): PaymentPayload =
        copy(scratchpad = scratchpad.with(result))

    fun withPayment(updated: Payment): PaymentPayload =  // only state-transition services call this
        copy(payment = updated)
}
```

| Half | Source | Persisted? | Lifetime | Who can mutate it |
| --- | --- | --- | --- | --- |
| `payment: Payment` | `:domain-model` sealed hierarchy (`PendingPayment`, `ScheduledPayment`, …, `ProcessedPayment`) | Yes — `trans_dtl` + `trans_lfcyc_event` | The lifetime of the payment (forever in `trans_lfcyc_event`) | `PaymentStateTransitionService` only |
| `scratchpad: WorkflowScratchpad` | `ServiceResult` instances returned by non-state-transitioning services | **No** | Workflow execution only | Any service can `.with(result)` to append |

## Service return-type contract

Each non-state-transitioning service interface declares its own `ServiceResult` subtype and returns it. State-transitioning services return a new-state `Payment` instead.

```kotlin
// Non-state-transitioning — returns a scratchpad value
interface PaymentValidationService {
    suspend fun validate(ctx: PaymentContext, payload: PaymentPayload)
        : Either<ValidationFailure, ValidatedPaymentResult>
}

@Serializable
data class ValidatedPaymentResult(                       // scratchpad-only; never on Payment
    val validatedAt: Instant,
    val rulesPassed: List<String>,
    val mandateId:   MandateId?,
) : ServiceResult

interface PaymentAllocationsRequestService {
    suspend fun request(ctx: PaymentContext, payload: PaymentPayload)
        : Either<AllocationsFailure, AllocationsResult>
}

@Serializable
data class AllocationsResult(
    val availableBalance: Money,
    val allocationsId:    AllocationsId,
    val snapshotTakenAt:  Instant,
) : ServiceResult

interface Customer360Service {
    suspend fun fetch(ctx: PaymentContext, payload: PaymentPayload)
        : Either<C360Failure, Customer360Data>
}

@Serializable
data class Customer360Data(
    val creditLimit:   Money,
    val accountStatus: AccountStatus,
    val riskScore:     Int,
) : ServiceResult

// State-transitioning — returns the new-state Payment
interface PaymentStateTransitionService {
    suspend fun transition(
        ctx: PaymentContext,
        payload: PaymentPayload,
        to: PaymentState,
        reason: String? = null,
    ): Either<TransitionFailure, Payment>                // ← new-state Payment, NOT a ServiceResult
}
```

**Why the type system, not a convention.** Because `ServiceResult` is a marker interface and `Payment` is a separate sealed hierarchy from `:domain-model`, a service author who tries to fold scratchpad data into the persisted Payment gets a compile error. The "should this go on `Payment`?" question is answered by the type, not by code review.

## Reading data inside a service or rule

```kotlin
@ApplicationScoped
class AmountWithinAllocationsAndLimitRule : ValidationRule {
    override val id = "amount-within-allocations-and-limit"
    override val requires = setOf(AllocationsResult::class, Customer360Data::class)

    override suspend fun evaluate(ctx: PaymentContext, payload: PaymentPayload): RuleResult {
        val allocations = payload.require<AllocationsResult>()       // from scratchpad
        val customer360 = payload.require<Customer360Data>()         // from scratchpad
        val amount      = payload.payment.amount                     // from Domain Model

        return when {
            amount > allocations.availableBalance ->
                RuleResult.Fail("EXCEEDS_ALLOCATIONS",
                                "Amount $amount exceeds allocations ${allocations.availableBalance}")
            amount > customer360.creditLimit ->
                RuleResult.Fail("EXCEEDS_CREDIT_LIMIT",
                                "Amount $amount exceeds credit limit ${customer360.creditLimit}")
            customer360.accountStatus != AccountStatus.ACTIVE ->
                RuleResult.Fail("ACCOUNT_INACTIVE", "Account status is ${customer360.accountStatus}")
            else -> RuleResult.Pass
        }
    }
}
```

| Pattern | Accessor | When to use |
| --- | --- | --- |
| Read Domain field | `payload.payment.<field>` | The value is part of the persisted payment (amount, instrument, account, state, clearing date, …) |
| Read scratchpad, required | `payload.require<T>()` | The rule cannot proceed without this prior result. Declare it in `requires` so the build verifies prerequisite ordering. |
| Read scratchpad, optional | `payload.optional<T>()` | Useful enrichment when present, but the rule has sane behaviour without it. |

## `@OrchestrationPlan` — workflow declares the order

The workflow declares which services it runs in what order. The plan can branch on the context — Corporate may run `PaymentAllocationsRequestService` before validation; Consumer may skip it.

```kotlin
@OrchestrationPlan(workflow = CreatePaymentWF::class)
object CreatePaymentOrchestration {
    fun planFor(ctx: PaymentContext): List<KClass<out Any>> = when (ctx.accountType) {
        AccountType.CORPORATE -> listOf(
            Customer360Service::class,
            PaymentAllocationsRequestService::class,
            PaymentValidationService::class,
            PaymentStateTransitionService::class,             // PENDING → ACCEPTED
            PaymentExecutionService::class,
            PaymentStateTransitionService::class,             // ACCEPTED → PROCESSING
        )
        AccountType.CONSUMER -> listOf(
            Customer360Service::class,
            PaymentValidationService::class,
            PaymentStateTransitionService::class,
            PaymentExecutionService::class,
            PaymentStateTransitionService::class,
        )
    }
}
```

The plan is plain Kotlin — no DI lookups, no clock, no random — so the workflow that consults it remains deterministic.

## OrchestrationLint

KSP cross-references **every rulebook reachable for every context** against the `@OrchestrationPlan` for the workflow that runs that rulebook. For each rule in each rulebook, the lint checks that the services producing the rule's `requires` types appear in the plan **before** the service that runs the rule.

If the check fails:

```
error: rulebook UsCorporateBaseRulebook (PaymentValidationService) requires AllocationsResult,
       but workflow CreatePaymentWFImpl does not run PaymentAllocationsRequestService before
       PaymentValidationService for variant (US, CORPORATE).
       Add it to CreatePaymentOrchestration.planFor((US, CORPORATE)) or remove the rule
       from the rulebook.
```

Missing-prior-result errors fail the build, not the first request in production. Adding a new cross-service rule is a build-time exercise in keeping the plan honest.

## Workflow walkthrough

End-to-end for `CreatePaymentWFImpl` with context `(US, CORPORATE, App, Immediate)` and payment amount `$6,200`. Comments inline.

```kotlin
override fun run(req: CreatePaymentRequest): PaymentResult = runBlocking {
    val ctx = PaymentContext(req.paymentMethod, req.market, req.accountType, req.frequency, req.paymentState)

    // Start with the hardened Domain Model in its initial state.
    var payload = PaymentPayload(payment = PendingPayment.from(req))

    // 1. Customer360 — adds Customer360Data to SCRATCHPAD (workflow-only, never persisted).
    val c360 = c360Resolver.resolve(ctx).fetch(ctx, payload).bindOrDecline(ctx)
    payload = payload.withScratchpad(c360)

    // 2. Allocations (Corporate only) — adds AllocationsResult to SCRATCHPAD.
    if (ctx.accountType == AccountType.CORPORATE) {
        val allocs = allocationsResolver.resolve(ctx).request(ctx, payload).bindOrDecline(ctx)
        payload = payload.withScratchpad(allocs)
    }

    // 3. Validation — rules read Domain (payload.payment.amount) + Scratchpad (c360, allocs).
    //    ValidatedPaymentResult goes into SCRATCHPAD — NOT folded into the Payment.
    val validated = validationResolver.resolve(ctx).validate(ctx, payload).bindOrDecline(ctx)
    payload = payload.withScratchpad(validated)

    // 4. DOMAIN STATE TRANSITION — the only path that mutates the Payment. Persists to trans_dtl.
    val accepted = stateResolver.resolve(ctx)
        .transition(ctx, payload, to = PaymentState.ACCEPTED).bindOrDecline(ctx)
    payload = payload.withPayment(accepted)

    // 5. Execution — sees the new Domain state + the accumulated scratchpad.
    val executed = executionResolver.resolve(ctx).execute(ctx, payload).bindOrDecline(ctx)
    payload = payload.withScratchpad(executed)

    // 6. Another DOMAIN STATE TRANSITION — ACCEPTED → PROCESSING, persisted.
    val processing = stateResolver.resolve(ctx)
        .transition(ctx, payload, to = PaymentState.PROCESSING).bindOrDecline(ctx)
    payload = payload.withPayment(processing)

    PaymentResult.ok(payload.payment)                       // return the hardened Domain Model only
}

private fun <F, R> Either<F, R>.bindOrDecline(ctx: PaymentContext): R =
    getOrElse { failure ->
        runBlocking {
            stateResolver.resolve(ctx).transition(ctx, payload, to = PaymentState.DECLINED, reason = failure.toString())
        }
        throw Workflow.wrap(NonRetryableFailure(failure.toString()))
    }
```

**The single rule that fires inside step 3** is `AmountWithinAllocationsAndLimitRule`. It reads `payload.payment.amount` (Domain), `payload.require<AllocationsResult>()` (Scratchpad, from step 2), and `payload.require<Customer360Data>()` (Scratchpad, from step 1). With `$6,200 ≤ $8,500` allocations and `$6,200 ≤ $50,000` credit limit and `ACTIVE` status, the rule passes. The full rulebook trace and counter-traces are in [Rule Engine › Worked example](./rule-engine.md#worked-example).

## Decision checklist — domain field or scratchpad?

| Question | Yes → | No → |
| --- | --- | --- |
| Is it persisted in `trans_dtl` or `trans_lfcyc_event`? | Domain | Scratchpad |
| Does it need to survive across workflow runs? | Domain | Scratchpad |
| Is it part of the customer-visible audit trail? | Domain | Scratchpad |
| Could the workflow legitimately run without it on replay? | Scratchpad | Domain |
| Does any other workflow or query read it? | Probably Domain | Scratchpad |

When in doubt, default to **Scratchpad**. Promoting a scratchpad value to a Domain field is a code-reviewed change to `:domain-model` and a database migration. Demoting a Domain field to a scratchpad is a breaking change. The asymmetry should bias the call.

## Serialization

`PaymentPayload`, `WorkflowScratchpad`, every `ServiceResult` subtype, and every `Payment` subtype must be `@Serializable` (`kotlinx.serialization`). Temporal's data converter is configured (in `:codec-server-app`) to use `kotlinx.serialization.json.Json` — there is no Jackson on the workflow path. See [Tooling Rationale › kotlinx.serialization](./tooling-rationale.md#kotlinx-serialization-not-jackson) for why.
