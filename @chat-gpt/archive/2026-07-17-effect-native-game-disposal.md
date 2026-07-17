# Effect-native retryable game disposal

Date: 2026-07-17

Related review tree:

- #227 — Electron launcher, shutdown, and packaged routing review
- #232 — persistence and controlled-shutdown follow-up review
- #228 — final-save shutdown retry

## Problem closed

The production `Game` returned by `createGameFx` cached its first `dispose()` Promise. When the final save failed, later disposal requests returned the same rejected Promise instead of reaching the retryable `GameSession` again. The wrapper also revoked resources and closed internally owned save storage from `finally`, even though save-mode disposal had not completed.

## Stable contract

Public game lifecycle operations are Effect programs:

```text
GameSession.disposeFx
GameSession.disposeWithoutSaveFx
GameSession.flushSaveFx
```

Promise is only a physical execution adapter at the owned `ManagedRuntime` boundary. A cached Promise must never be the lifecycle source of truth.

`GameSession` owns one explicit lifecycle state:

```text
running
→ disposing(result Deferred)
→ disposed on success
→ frozen on failed final save
```

Concurrent disposal callers share the same active attempt through one `Deferred`. A later caller after failure starts a fresh attempt against the same frozen session.

Game-owned resources use one `Scope`, but final save is deliberately not a scope finalizer. The resource scope closes only after:

- successful save-mode disposal; or
- explicit discard / force-exit disposal.

A failed final save therefore preserves the frozen session, resource URLs, and internally owned save storage for retry.

## Implementation boundaries

- `createGameSessionFx` owns retryable disposal state, active-attempt sharing, loop stop, save flush/discard, and final session release.
- `createGameFx` only composes session disposal with release of game-owned resources.
- `createGameOwnerFx` consumes the Effect lifecycle operations through its existing runtime execution boundary. Its broader latest-request/coalescing queue remains a separate concern and was not redesigned here.

## Permanent regression coverage

The public `createGameFx` path now proves:

- first final write may fail;
- the first `disposeFx` fails truthfully;
- resources remain available and storage remains usable;
- a second `disposeFx` performs a second write and succeeds;
- cleanup occurs only after that success;
- explicit `disposeWithoutSaveFx` completes cleanup after a failed save;
- concurrent disposal callers share one in-flight save attempt.

The architecture guard rejects restoration of the public Promise disposal API or a `disposePromise` cache in `createGameFx`.

## Verification

- format: 1,147 files passed
- Dependency Cruiser: 922 modules / 4,026 dependencies, zero violations
- source, test, and Electron typechecks passed
- game validation passed
- production Electron build passed
- permanent test suite: 204 files / 641 tests passed in ten explicit single-worker shards

The aggregate `npm run check` reached the test phase successfully, but the environment's default parallel Vitest worker launch stalled without producing a test result. Running the same canonical ten shards as separate single-worker Vitest processes completed the full suite.
