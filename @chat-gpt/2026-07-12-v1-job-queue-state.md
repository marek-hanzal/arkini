# V1 Tick, active job, and queued start model

## Canonical mental model

- Filling a product line is passive and never starts work.
- `startLineFx` is the explicit command used by UI and automation.
- One owner may have one active job plus FIFO queued start requests up to `maxQueueSize`.
- A queued request is not a job. It has no time, consumes nothing, and reserves nothing.
- Queue dispatch uses the same internal `startLineRuntimeFx` pipeline as an immediate explicit start.
- A queued request is revalidated against the current runtime when dispatched. If it cannot start, it remains first in FIFO and nothing behind it may pass.

## Time acquisition model

- Effect `Clock` is the only production real-clock source.
- `TickFx` owns one transient session cursor: `observedAtMs` plus `pendingElapsedMs`.
- Clock acquisition and runtime application are one serialized failure-safe operation. There is no public `pulse → run` protocol and no mutable replayable Tick snapshot.
- `runTickRuntimeFx` reads Effect Clock, adds newly elapsed real time to the pending budget, and applies every complete fixed step at most once.
- `runTickRuntimeByFx` injects an explicit local elapsed duration through the exact same budget protocol for deterministic tests and controlled callers.
- A successful runtime advancement consumes only complete 200 ms steps; a smaller remainder stays pending until later elapsed time completes the next step.
- A failed runtime advancement advances the clock cursor but retains the entire combined pending budget for retry. No elapsed time is lost or replayed accidentally.
- A second run without newly elapsed or explicitly injected time is a no-op.
- Concurrent Tick advancement requests serialize through the Tick service.

## Job time model

- Active jobs persist only `durationMs` and `remainingMs`.
- No job timestamps, scheduled start timestamps, due timestamps, pause timestamps, or relative-time reconstruction are allowed.
- The canonical simulation step is 200 ms and `GameLoopLayerFx` uses the same value as its default wake cadence.
- Each fixed step resolves every active job's live rules from one shared step-start runtime snapshot.
- Runnable jobs decrement `remainingMs` by one step, clamped at zero; paused jobs keep `remainingMs` unchanged.
- Jobs reaching zero complete at the step boundary in stable job-ID order. A queued successor may start at that boundary but does not consume work time until the following step.
- Cross-owner mutations created during one step therefore affect another job's time progression only from the next step.
- Runtime job-array ordering does not affect step semantics.
- A long elapsed interval is replayed immediately as consecutive fixed steps and must match the equivalent sequence of explicit 200 ms advancements.

## Completion and reservations

- Started jobs cannot be cancelled.
- `reserve` inputs move to `location.scope === "job"` and remain an exclusive job-owned lock.
- Generic item mutations reject job-scoped items through `assertNonJobScopeFx`.
- Completion removes all reservation representations, releases all reserved resources through standard drop placement, resolves output through standard output placement, and removes the job.
- Completion is all-or-nothing. Partial reservation release or partial output placement is forbidden.
- No historical slot, position, runtime instance identity, or source stack is retained.

## Current implementation boundaries

- `TickFx`: failure-safe pending elapsed-budget service backed by a `SynchronizedRef` in `GameCoreLayerFx`.
- `runTickRuntimeFx`: production Tick entrypoint using Effect Clock.
- `runTickRuntimeByFx`: deterministic local elapsed-time entrypoint using the same Tick protocol.
- `TickStepMs`: the single canonical 200 ms simulation resolution and default production loop cadence.
- `advanceRuntimeElapsedFx`: replays one already-acquired whole-step budget in one runtime transaction.
- `advanceRuntimeStepFx`: advances one shared-snapshot fixed simulation step.
- `startLineRuntimeFx`: canonical internal start pipeline used by direct start and queue dispatch.
- `completeJobRuntimeFx`: canonical internal completion draft operation.
- `readOwnerJobQueueFx`: derives `running`, `paused`, or `ready` from `remainingMs` and live rules.

## Guardrails

- Do not reintroduce `pulseTickFx`, public Tick setters, or independently callable acquire/apply halves.
- Do not reintroduce `startedAtMs`, `dueAtMs`, `pausedAtMs`, or future queued job timestamps.
- Do not create queued jobs in advance.
- Do not create a queue-specific start implementation.
- Do not pass stale preview plans into writes.
- Do not clamp or discard elapsed real time merely because the browser tab slept.
- Do not add job cancellation.
