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

### Completed block 3: queue-only owner and FIFO

- [x] Tick workset includes owners with active jobs and queue-only owners with queued requests.
- [x] Dispatch a queue-only FIFO head through `startLineRuntimeFx` at the beginning of every fixed step.
- [x] Leave a blocked FIFO head in place and retry it on a later step.
- [x] Never let an explicit start overtake an older queued request.
- [x] Append newer explicit requests behind existing FIFO work when capacity permits.

### Completed block 4: blocked completion isolation

- [x] One completion remains reservation/output/job-removal all-or-nothing.
- [x] Capacity and max-count placement blocking leave that job ready and its reservations locked.
- [x] Other owners continue and commit through the same fixed step.
- [x] Invalid replacement semantics and unexpected defects still rollback the whole advancement and retain its Tick budget.
- [x] A later fixed step retries the ready completion after capacity changes.

### Completed block 5: session command shutdown

- [x] Track command fibers started through `GameSession.run` in a session-owned `FiberSet`.
- [x] Reject new commands once disposal starts.
- [x] Dispose stops Tick, interrupts and awaits in-flight commands, then performs final save.
- [x] A delayed command cannot commit after the final save.
- [x] Concurrent dispose callers await the same memoized cleanup Promise.
- [x] Throwing Tick/save reporters and runtime/event listeners are logged without killing infrastructure fibers.

### Completed review follow-up: deterministic completion randomness

- [x] Give every completion a versioned deterministic Effect `Random` stream derived from stable job identity.
- [x] Scope the stream around the entire completion, including output rolls and random placement ordering.
- [x] Keep blocked retry and state-restore outcomes stable without persisting a resolved output manifest.
- [x] Keep job revision, Tick state and wall-clock time out of the seed.

### Completed review follow-up: board-only owner execution

- [x] Treat inventory as a hard pause for active and ready jobs.
- [x] Prevent queue dispatch and explicit line start while the owner is in inventory.
- [x] Resume normal execution after the owner returns to the board.
- [x] Reject inventory coordinates as line-rule and placement origins.

### Completed review follow-up: stable no-op fast-forward

- [x] Replay changing 200 ms steps literally inside one locked runtime transaction.
- [x] Detect an event-free same-reference step as a stable no-op boundary.
- [x] Consume the remaining elapsed backlog without repeating identical domain work.
- [x] Preserve long-Tick equivalence by fast-forwarding only after the first proven stable step.
- [x] Cover empty, inventory-paused and completed-then-idle backlogs with processed/skipped-step regressions.

### Block 6: runtime invariants and cleanup

- [x] Enforce at most one active job per owner.
- [x] Treat queue-only owners as explicit valid runtime state.
- [x] Classify only missing inputs, disabled line state and inventory ownership as retryable queue blocks.
- [x] Propagate missing owner, missing line and future structural start failures instead of retrying forever.
- [x] Remove the misleading unused owner queue time helper.
- [x] Permanent owner removal is forbidden while active or queued work exists.
- [x] Removing an idle owner releases its buffered input contents through ordinary scope-aware drop placement, all-or-nothing.

## Final owner removal contract

- An owner with an active job or queued request cannot be removed.
- Moving an owner to inventory is not removal; its work remains paused and intact.
- Removing an idle owner also removes its buffered input representations and re-emits their quantities atomically through normal placement.
- A board owner uses its current board position as the drop origin.
- An owner outside the board releases buffered inputs into inventory.
- Buffered inputs retain no historical source location, source stack, or source runtime identity.
- Any placement failure rolls back the owner removal and every buffered release.
