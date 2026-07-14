> **Resolved in `0e8b49a3 Harden v1 transition store with STM`.** Runtime mutation planning remains interruptible and serialized by its own semaphore; accepted current replacement, publication and result now share one non-yielding STM transaction. Listener registration atomically captures `TRef` current plus a `TPubSub` `TQueue` without touching the planning semaphore, so React subscription stays synchronous under contention. The canonical current contract is `@chat-gpt/2026-07-12-v1-managed-session-runtime.md`.

# Arkini v1 atomic boundary final — deep review handoff

- Reviewed snapshot: `f244105b1805c876e58820156f42db7ec5041c97`
- Baseline: `3435ca0ecd4c6a09347f33ef80ab323641c15958`
- Review scope: all commits since baseline plus a fresh pass over v1 runtime/session/save/UI boundaries, atomicity, redundant synchronization/data flow, subscription temporal semantics, cancellation, and LLM mental load
- Repository changes made by review: none

## Executive verdict

The snapshot fixes the two open findings from the previous review at the correct architectural level:

1. late subscribers no longer receive transitions committed before their registration;
2. event-only transitions no longer wake or postpone autosave.

The new topology is materially cleaner:

```text
one canonical RuntimeStoreFx
→ current CommittedTransition
→ ordered PubSub publication
→ listener-specific current + tail subscriptions
```

The old central delivery bridge and mutable listener registries are gone. `createGameSession` still reads the canonical runtime directly, no raw-runtime mirror has returned, and no new event bus or React-owned truth was introduced.

The closeout is **not fully done yet**. The new root solution introduces one confirmed P1 boundary failure and exposes one further atomic cancellation gap:

1. **P1 — synchronous React subscription can throw while any runtime transaction owns the store semaphore.** Reproduced as `AsyncFiberException`.
2. **P1/P2 — the canonical commit tail (`Ref.set → PubSub.publish → command result`) remains interruptible, so session disposal/cancellation can theoretically split current state, publication, and the caller-visible result.** This is structurally present in the code even though the tiny scheduling window was not reproduced reliably.

No gameplay/domain regression was found. No domain logic currently leaks into `src/v1/ui`.

---

# Commit review

## `74bb3c8c Fix v1 session subscription linearization`

### What is good

The commit solves the previous late-subscriber defect at the root rather than layering registration markers around the old central bridge.

Confirmed:

- `GameSessionTransitionBridgeFx` is removed;
- every runtime/event listener opens its own atomic current-plus-tail subscription;
- a commit before registration becomes `subscription.current` and is not replayed;
- a commit after registration enters that listener's queue exactly once;
- event-only transitions do not notify runtime subscribers;
- nested subscription from an existing callback does not receive the currently delivered transition;
- unsubscribe shuts the listener queue before later commits;
- no second runtime mirror or event source was introduced.

`GameSessionTransitionSubscriptionsFx` is locally easy to understand. The duplication between runtime and event subscriptions is acceptable because each branch expresses a different projection and delivery policy. Do not mechanically genericize it into callback soup.

### What is not done

The same semaphore now owns two incompatible responsibilities:

```text
A. serialize the entire effectful runtime transaction
B. provide a synchronous React subscription registration boundary
```

That conflict creates the P1 finding below.

## `c3287edd Isolate v1 autosave from transient events`

Approved.

The stream now does the correct projection before scheduling:

```text
CommittedTransition
→ transition.runtime
→ changesWith(Object.is)
→ debounce
→ flush latest canonical runtime
```

This removes unnecessary event data from autosave timing without introducing another state source.

Confirmed:

- event-only traffic does not trigger save;
- event-only traffic does not reset a pending runtime debounce;
- runtime changes still coalesce;
- explicit flush and autosave remain serialized by one save mutex;
- initial save and final flush semantics remain intact.

This is exactly the kind of consumer-specific projection the architecture should permit.

## `f244105b Close v1 atomic boundary guardrails`

Approved.

Confirmed:

- v1 core → UI imports are forbidden by Dependency Cruiser;
- v1 UI → core internal imports remain forbidden;
- the checks are part of `npm run check`;
- the superseded concurrency audit was moved from active root notes into the archive;
- the canonical managed-session document describes the new topology;
- no giant semantic static-analysis contraption was added.

The guardrails are proportionate and understandable.

---

# Findings

## P1 — `GameSession.subscribe()` is not reliably synchronous under valid runtime contention

### Locations

- `src/v1/runtime/internal/makeRuntimeStoreFx.ts:14-39`
- `src/v1/ui/session/GameSessionTransitionSubscriptionsFx.ts:31-95`
- `src/v1/ui/session/createGameSession.ts:89-115`
- canonical documentation: `@chat-gpt/2026-07-12-v1-managed-session-runtime.md:75-94`

### Current topology

`makeRuntimeStoreFx` uses one semaphore for both mutations and subscriptions:

```text
modifyEffect
→ acquire semaphore
→ run the whole update Effect
→ validate/build transition upstream
→ set current
→ publish
→ release semaphore

subscribe
→ acquire the same semaphore
→ read current
→ subscribe queue
→ release semaphore
```

`createGameSession` must expose a synchronous React-compatible API, so it executes listener registration through:

```ts
managed.runSync(transitionSubscriptions.subscribe(listener))
```

When a mutation already owns the semaphore, `subscribe` must wait asynchronously for a permit. `runSync` cannot do that.

### Reproduced failure

A targeted probe held `modifyRuntimeFx` inside an effectful update using a `Deferred`, then called `session.subscribe()` before releasing the transaction.

Observed result:

```text
(FiberFailure) AsyncFiberException:
Fiber cannot be resolved synchronously.
This is caused by using runSync on an effect that performs async work.
```

The same underlying failure applies to `subscribeEvents()`.

### Why this is a real boundary defect

React's `useSyncExternalStore` subscription function is synchronous by contract. It cannot return a Promise or wait for an engine transaction.

The runtime update API is explicitly effectful and the repository already tests asynchronous serialized updates. Even production CPU-bound Tick work can cooperatively yield while retaining the mutation semaphore. A React mount/remount or new presentation consumer may therefore attempt subscription while the engine is legitimately busy.

Consequences:

- subscription can throw during normal lifecycle concurrency;
- React can fail to mount/re-subscribe;
- a failed registration creates a child listener scope before semaphore acquisition, so repeated failures may also retain child scopes until session disposal;
- the documentation claim that acquisition “contains no asynchronous boundary and can be completed through `runSync`” is false when the semaphore is contended.

### Root cause

The store conflates:

1. **long transaction serialization**, which may be effectful and wait/yield;
2. **tiny commit/subscription linearization**, which must be synchronously available to the external-store adapter.

The root fix is to separate those concerns. Do not catch `AsyncFiberException`, defer React subscription, queue a later registration, or add another mirror. Those are symptom patches and would weaken `useSyncExternalStore` semantics.

### Required target

```text
runtime transaction may be long/effectful
→ subscription registration never waits for that whole transaction
→ commit and subscription registration still have one deterministic linearization point
→ session.subscribe() always completes synchronously
```

A suitable design should keep:

- one canonical current transition;
- one serialized runtime mutation path;
- one publication source;
- no revision counter unless genuinely necessary;
- no central listener registry evaluated after commit;
- no React state/ref mirror.

The likely shape is separate transaction serialization from a very small non-yielding commit/registration boundary owned by the canonical store.

### Acceptance tests

- hold a runtime update on a `Deferred`; `session.subscribe()` must still return synchronously and must not throw;
- same test for `session.subscribeEvents()`;
- if the pending mutation eventually commits after registration, the listener receives it exactly once;
- if it committed before registration, it is captured as current and not replayed;
- failed/interrupted update is not delivered;
- no leaked listener scope after failed registration;
- a `useSyncExternalStore` integration smoke test survives registration while Tick/command work is active.

---

## P1/P2 — commit, publication, and caller result are not cancellation-atomic

### Location

`src/v1/runtime/internal/makeRuntimeStoreFx.ts:14-26`

### Current commit tail

```ts
yield* Ref.set(current, nextTransition);
yield* PubSub.publish(changes, nextTransition);
return result;
```

The whole body is wrapped in `semaphore.withPermits(1)`, but Effect's semaphore helper restores the body as interruptible. It guarantees permit release; it does **not** make the body transactional or uninterruptible.

`createGameSession.dispose()` intentionally closes the command scope and interrupts active command fibers. Therefore interruption can theoretically land in either dangerous window:

```text
Ref.set completed
→ interruption
→ PubSub.publish never happens
```

or:

```text
Ref.set + publish completed
→ interruption before result escapes
→ caller sees failure although mutation committed
```

### Why it matters

This code is the canonical atomic engine boundary. The project explicitly requires:

```text
candidate fails/interrupted before commit
→ no state, no events, no success

commit begins
→ state + events + caller-visible completion stay coherent
```

The current implementation guarantees normal successful ordering, but not cancellation atomicity.

The first window can leave:

- `getSnapshot()` on transition N+1;
- subscribers/autosave never notified of N+1.

The second can encourage an external caller to retry an operation that already committed.

This is a narrow scheduling window and was not reliably reproduced in the review environment. It is nevertheless directly implied by the effect structure and deserves a focused fix because this store exists specifically to be the atomic boundary.

### Required target

Keep transaction planning interruptible, but establish a point of no return:

```text
acquire mutation serialization
→ run update + validation interruptibly
→ once candidate is accepted:
     commit current + publish + return result as one protected tail
```

Do not make the entire Tick/job transaction uninterruptible. Only the final accepted commit tail needs protection.

### Acceptance tests

Use a controllable store-level test seam rather than timing roulette:

- interrupt before accepted commit: current unchanged, no publication, caller interrupted;
- interrupt at commit boundary: current and publication either both absent or both present;
- once current is visible, the command result must not report an uncommitted-style failure;
- dispose during a long pre-commit update leaves old runtime and no event;
- dispose after commit does not lose autosave/subscriber notification.

---

# Previous review closure matrix

| Previous finding | Status | Notes |
|---|---|---|
| New subscriber receives an already committed event | **Closed** | Listener-specific current + tail subscription fixes temporal membership at registration. |
| Runtime subscriber receives stale invalidation after registration | **Closed** | Captured current is baseline only; only later changed runtime roots notify. |
| Event-only transition postpones autosave | **Closed** | Runtime identity is projected before debounce. |
| Superseded root document can mislead LLM retrieval | **Closed** | Historical audit moved into `@chat-gpt/archive`. |
| Core/UI dependency guard is incomplete | **Closed** | Dependency Cruiser now enforces both directions required by current policy. |
| Canonical runtime mirror split | **Still closed** | `getSnapshot()` reads the canonical runtime directly. |
| Async callback rejection can kill infrastructure | **Still closed** | Callback PromiseLike rejection remains isolated. |

The prior closeout review can be considered done once the two new store-boundary findings above are resolved or explicitly decided.

---

# Atomicity and unnecessary synchronization audit

## Good current properties

- one committed transition contains runtime plus event metadata;
- candidate runtime is validated before normal commit;
- failed candidate publishes nothing;
- no-op without events preserves transition identity;
- `getSnapshot()` reads canonical runtime directly;
- React holds no raw-runtime mirror;
- event-only transition preserves runtime root identity;
- autosave observes runtime identity only;
- save watermark is persistence state, not gameplay truth;
- UI currently computes no gameplay decisions;
- no public production write bypass was found;
- no in-place runtime mutation was found in the reviewed diff.

## Data passing review

Every listener currently owns one PubSub queue and receives the same transition reference before projecting runtime or events.

This is duplicated scheduling, but not duplicated gameplay truth or copied runtime data. At the current scale it is an acceptable correctness-first tradeoff and is easier to reason about than the old central listener fanout.

Do **not** re-centralize it merely to reduce queue count unless profiling demonstrates an actual problem. The previous central fanout failed precisely because listener membership was evaluated at delivery time.

The immediate architectural problem is not the number of queues. It is that subscription registration must wait on a semaphore held across the whole mutation.

## UI boundary review

Current `src/v1/ui` remains clean:

- `useRuntimeSelector` performs presentation projection only as infrastructure;
- no current selector reconstructs line readiness, reservation state, queue policy, drop acceptance, or other domain booleans;
- `useGameCommand` adapts Effects without reimplementing command semantics;
- `useGameEvents` forwards transient batches;
- core has no UI/React dependency;
- UI has no core-internal imports.

The accepted soft contracts remain reasonable:

- no recursive deep-freeze project;
- no command-facade onion around `GameSession.run()`;
- review rejects snapshot mutation and direct internal-service use from UI.

---

# LLM mental-load review

## Material improvement

The new design is easier to follow than `3435ca0e`:

```text
RuntimeStoreFx
→ canonical current transition
→ serialized modify
→ listener-specific subscription
```

`GameSessionTransitionSubscriptionsFx` answers one clear question: how one external listener projects later committed transitions.

`RuntimeSaveLayerFx` now clearly owns runtime persistence and no longer needs to mentally filter event activity after debounce.

`createGameSession` remains linear and should not be split further merely because it is over one hundred lines.

## Current hotspot

`makeRuntimeStoreFx` looks simple, but one semaphore silently represents two different temporal contracts:

```text
command serialization
subscription registration linearization
```

That hidden coupling is the largest current mental hazard. A reader sees “one mutex = safe,” while the synchronous React boundary makes that statement false under contention.

After separating the responsibilities, keep the store compact and document the two boundaries explicitly:

1. mutation planning is serialized and may be effectful;
2. accepted commit plus subscription registration use a tiny synchronous/non-yielding linearization edge.

Do not scatter the store into a dozen single-purpose files. The current file size is good; the responsibility coupling is the problem.

---

# Recommended implementation order

1. **Fix synchronous subscription under mutation contention.**
   - Separate long mutation serialization from synchronous commit/subscription linearization.
   - Add deterministic contention tests before changing implementation.

2. **Protect the accepted commit tail against interruption.**
   - Keep update/validation interruptible.
   - Make current replacement, publication, and caller-visible success coherent.

3. **Update the canonical managed-session document.**
   - Remove the false statement that semaphore-backed subscription acquisition is always synchronously runnable.
   - Describe the final two-boundary model.

4. **Run the full boundary matrix.**
   - registration before/after/racing commit;
   - interruption before/at/after commit;
   - dispose with active command;
   - event-only save isolation;
   - runtime/event listener ordering and snapshot visibility.

---

# Do not do

- Do not catch `AsyncFiberException` and silently retry registration later.
- Do not make `GameSession.subscribe()` asynchronous.
- Do not add a React snapshot mirror, readiness flag, or local revision cache.
- Do not restore a separate event bus.
- Do not reintroduce a central listener set whose membership is read at delivery time.
- Do not make the entire runtime transaction uninterruptible.
- Do not add a persisted/global revision counter unless a simpler synchronous commit edge genuinely cannot solve the problem.
- Do not replace listener-specific subscriptions with a more abstract system solely to reduce file count.

---

# Definition of done

The atomic session boundary is done when all of the following hold:

- `getSnapshot()` is always the canonical committed runtime;
- `subscribe()` and `subscribeEvents()` always complete synchronously, even while a mutation is in flight;
- registration has one deterministic before/after commit outcome;
- no transition committed before registration is replayed;
- every transition committed after registration is delivered exactly once and in order;
- current transition and publication cannot diverge under interruption;
- a caller cannot observe failure for an operation that has already committed as though it were safe to retry;
- event-only traffic does not notify runtime subscribers or affect autosave;
- dispose cannot leave a half-committed transition;
- UI owns no gameplay truth and no raw-runtime mirror;
- no new synchronization cache, listener registry, event source, or façade onion is introduced.

---

# Verification

```text
HEAD: f244105b1805c876e58820156f42db7ec5041c97
baseline: 3435ca0ecd4c6a09347f33ef80ab323641c15958
git status: clean

git diff --check: passed
format: passed (1978 files)
dependency graph: passed (486 modules / 1982 dependencies)
source typecheck: passed
test typecheck: passed
tests: 123 files / 323 tests passed
game:validate game/arkini: passed
repository commits made by review: none
```

## Destructive probes

Temporary probe files were removed after execution.

Confirmed probe:

```text
runtime mutation holds the store semaphore on a Deferred
→ session.subscribe() called synchronously
→ ManagedRuntime.runSync throws AsyncFiberException
```

A separate attempt to force interruption precisely between `Ref.set` and `PubSub.publish` was not reliable in the constrained test worker and is therefore not presented as a reproduced failure. The cancellation finding is based on the explicit interruptible effect structure, not on a claimed successful reproduction.
