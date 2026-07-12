# V1 Tick fixed-step implementation plan

Accepted after the independent Tick/queue review and follow-up architecture discussion.

## Final time direction

- Effect Clock remains the only production wall-clock source.
- Tick time is session infrastructure and is not persisted in `RuntimeSchema`.
- The Tick service owns an accumulated pending elapsed budget and applies it at most once.
- Simulation will use one canonical 200 ms fixed step.
- Long/offline elapsed time will be replayed immediately as consecutive fixed steps; no artificial delay or UI catch-up debounce is required.
- A long sleeping-tab interval must produce the same gameplay result as the equivalent sequence of normal 200 ms steps.
- Cross-owner changes created during one fixed step become visible when the next fixed step is evaluated.
- Job time remains only `durationMs` and `remainingMs`; timestamps stay forbidden.

## Completed block 1: Tick budget protocol

- [x] Removed the independently callable `pulseTickFx` and mutable Tick setter.
- [x] `TickFx` now owns `observedAtMs` and `pendingElapsedMs` in a `SynchronizedRef`.
- [x] Production `runTickRuntimeFx` acquires Effect Clock time and applies it through one serialized operation.
- [x] Deterministic `runTickRuntimeByFx` injects elapsed time through the same protocol.
- [x] Successful advancement consumes the budget once.
- [x] Failure keeps the full combined budget pending while advancing the clock cursor.
- [x] Zero-new-time retry is a no-op after success and retries pending time after failure.
- [x] Concurrent Tick advancement requests serialize without losing elapsed time.

## Remaining blocks

### Completed block 2: fixed-step runtime

- [x] Split each acquired elapsed budget into 200 ms simulation steps plus a retained sub-step remainder.
- [x] Use one `TickStepMs` value for simulation resolution and the default production loop cadence.
- [x] Evaluate active-job live rules from one step-start runtime snapshot.
- [x] Advance concurrent jobs from the same snapshot semantics.
- [x] Apply completions at the step boundary in stable job-ID order.
- [x] Start queued successors at the boundary without granting them retroactive time from that step.
- [x] Make runtime job-array ordering irrelevant to cross-owner time progression.
- [x] Prove one long Tick equals equivalent small fixed steps.

### Block 3: queue-only owner and FIFO

- Tick workset is owners with active jobs union owners with queued requests.
- Dispatch a queue-only FIFO head through `startLineRuntimeFx`.
- Never let an explicit start overtake an older queued request.

### Block 4: blocked completion isolation

- One completion remains reservation/output/job-removal all-or-nothing.
- Expected placement blocking leaves that job ready and its reservations locked.
- Other owners continue through the same fixed step.
- Unexpected defects/invariant failures rollback the whole step and retain its Tick budget.

### Block 5: session command shutdown

- Track command fibers started through `GameSession.run`.
- Dispose stops Tick, interrupts/awaits in-flight commands, then performs final save.

### Block 6: runtime invariants and cleanup

- Enforce at most one active job per owner.
- Treat queue-only owners as explicit valid runtime state.
- Remove the misleading unused owner queue time helper.
- Owner movement on board or into inventory remains allowed and may pause live rules.
- Permanent owner removal is forbidden while active or queued work exists.
