---
title: Temporal Activities
sidebar_position: 3
---

# Temporal Activities

**Activities are the bridge between deterministic workflow code and the real world.** Anything a [Temporal Workflow](./temporal-workflows.md) cannot do directly — read the clock, call a database, hit an HTTP endpoint, generate a UUID — happens inside an activity.

## Build-time rules

- **One activity per side-effect boundary.** Validating a payment, calling clearing, writing to `trans_dtl`, publishing a lifecycle event — each is a separate activity. Workflows compose them; activities never call other activities.
- **Activities wrap services.** Most activities are thin shells that delegate to a [Payment Service](./payment-services.md) implementation. The activity layer exists to give Temporal something it can retry, time out, and record in history — the *logic* lives in the service.
- **Activities must be idempotent.** Temporal *will* retry. An activity that writes half-state and throws will be retried with the same input and must not double-write. Pair every state-changing activity with a `PaymentStateTransitionService` call so the lifecycle row is the source of truth.
- **Activity timeouts are explicit, not defaulted.** Every activity declares `startToCloseTimeout`, `scheduleToCloseTimeout`, and a retry policy. The defaults are not safe for money movement — we set them per activity, deliberately.
- **Activities should be small.** A long activity is harder to retry safely and harder to observe. Prefer many short activities over one long one — Temporal handles the orchestration cheaply.

## Naming convention

`XxxActivity` interface + `XxxActivityImpl` implementation:
- `PaymentValidationActivity`
- `PaymentClearingActivity`
- `PaymentNotificationActivity`

The implementation usually receives the corresponding `Service` via constructor injection and calls into it.

## Where activities live in the build

- **`:activity-api`** modules — interfaces only. Workflows depend on these.
- **`:activity-impl`** modules — implementations that wire activities to services. Only the worker process depends on these.

A workflow module *cannot* depend on activity-impl. This rule is enforced by the build and is what guarantees the workflow stays deterministic at compile time.

:::tip
If a service is hard to test in isolation, that usually means the activity wrapping it is doing too much. Push everything except *the call to Temporal* out of the activity and into the service.
:::
