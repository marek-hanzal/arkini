# V1 tick, active job, and queued start model

## Canonical mental model

- Filling a product line is passive and never starts work.
- `startLineFx` is the explicit command used by UI and automation.
- One owner may have one active job plus FIFO queued start requests up to `maxQueueSize`.
- A queued request is not a job. It has no time, consumes nothing, and reserves nothing.
- Queue dispatch uses the same internal `startLineRuntimeFx` pipeline as an immediate explicit start.
- A queued request is revalidated against the current runtime when dispatched. If it cannot start, it remains first in FIFO and nothing behind it may pass.

## Time model

- Effect `Clock` is the only real-clock source.
- `TickFx` stores one immutable tick snapshot: `nowMs` and real `elapsedMs`.
- `pulseTickFx` captures elapsed real time through Effect `Clock`; sleeping or backgrounding a tab does not discard elapsed time.
- Active jobs persist only `durationMs` and `remainingMs`.
- No job timestamps, scheduled start timestamps, due timestamps, pause timestamps, or relative-time reconstruction are allowed.
- A runnable job decrements `remainingMs` by the tick budget.
- A job whose live rules fail is paused and keeps `remainingMs` unchanged.
- A long tick may complete the active job, dispatch and complete every runnable queued request, and leave the final job partially progressed with the unused remainder of the same elapsed budget.
- Each owner receives the full elapsed tick budget independently because owners work concurrently.

## Completion and reservations

- Started jobs cannot be cancelled.
- `reserve` inputs move to `location.scope === "job"` and remain an exclusive job-owned lock.
- Generic item mutations reject job-scoped items through `assertNonJobScopeFx`.
- Completion removes all reservation representations, releases all reserved resources through standard drop placement, resolves output through standard output placement, and removes the job.
- Completion is all-or-nothing. Partial reservation release or partial output placement is forbidden.
- No historical slot, position, runtime instance identity, or source stack is retained.

## Current implementation boundaries

- `TickFx`: shared tick snapshot service backed by a Ref in `GameLayerFx`.
- `pulseTickFx`: captures one real-time tick from Effect `Clock`.
- `runTickRuntimeFx`: applies one tick atomically to all active owners.
- `startLineRuntimeFx`: canonical internal start pipeline used by direct start and queue dispatch.
- `completeJobRuntimeFx`: canonical internal completion draft operation.
- `readOwnerJobQueueFx`: derives `running`, `paused`, or `ready` from `remainingMs` and live rules.

## Guardrails

- Do not reintroduce `startedAtMs`, `dueAtMs`, `pausedAtMs`, or future queued job timestamps.
- Do not create queued jobs in advance.
- Do not create a queue-specific start implementation.
- Do not pass stale preview plans into writes.
- Do not clamp or discard elapsed real time merely because the browser tab slept.
- Do not add job cancellation.
