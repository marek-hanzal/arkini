# Effect-owned GameOwner concurrency

## Scope

Review task #239 replaced the root live-game owner's private Promise scheduler while preserving package switching, hard reset, save recovery, controlled close, HMR handoff, stale bootstrap disposal, force discard, and synchronous external-store snapshots.

## Final ownership grammar

```text
public owner command Effect
→ command Queue
→ per-command Deferred acknowledgement
→ one Semaphore-owned drain
→ authoritative dispose / clear / create checkpoints
→ one matching snapshot and command outcome
```

The owner no longer captures an Effect runtime, calls `Runtime.runPromise*`, caches `running: Promise`, or tracks request/settled version counters. Promise remains only at explicit renderer runtime boundaries and for isolated Promise-like subscriber callbacks.

Commands absorbed during one active drain deliberately share the final winning intent outcome. Invalid commands fail only their own acknowledgement. Disposal, save-clear, bootstrap, and recovery errors both publish the matching failed state and fail the initiating command Effect. Superseded bootstrap failures are ignored; completed stale games are disposed exactly once.

Authoritative owner work is uninterruptible until the current ownership checkpoint settles. Interrupting a caller therefore cannot detach background Promise work or leave a half-published owner transition; the command fiber remains the owner of that work and receives interruption after coherence is restored.

## Public contract

`GameOwner.ts` owns the stable interface and state union. `createGameOwnerFx.ts` owns the single implementation operation. `shutdownGameOwnerFx` now forwards the honest `replaceFx(null)` result directly instead of re-reading UI state to reconstruct failure.

## UI contract

`GameShell` deliberately absorbs rejected owner command Promises at the renderer execution boundary because the same authoritative failure is already published for rendering. Controlled close and HMR callers continue to observe and propagate command failure where shutdown success matters.
