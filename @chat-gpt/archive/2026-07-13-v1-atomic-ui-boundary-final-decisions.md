# Arkini v1 atomic engine/UI boundary review — final decisions

- Snapshot HEAD: `7e2d80a1c23908eb5239bd66f754073415fa6d10`
- Review baseline: `23aa7b7a`
- Supersedes: `arkini-v1-atomic-ui-boundary-deep-review-7e2d80a1.md`
- Repository changes made by review: none

## Executive verdict

The internal transition model is materially improved and the previous queue/session findings are effectively closed:

- runtime and transient events now commit as one `CommittedTransition`;
- failed candidates publish neither runtime nor events;
- concurrent disposal shares one completion promise;
- synchronous callback defects are isolated;
- job completion and queue attempts resolve live entities internally;
- owner removal and buffered-input release preserve one atomic lifecycle transition.

The remaining hard architectural defect is `createGameSession` maintaining an asynchronous second raw-runtime truth beside the canonical engine store. This must be fixed.

Two other findings from the previous report are intentionally **not** implementation priorities:

- mutable runtime aliases are accepted as a soft public-contract risk for this game codebase;
- generic `GameSession.run()` remains accepted to avoid a bloated capability/facade onion.

Both must still be guarded through code review, documented boundaries and a thin React bridge. They are not invitations to bypass the engine.

---

# Final project decisions

## Decision A — Runtime immutability is a soft contract, not a recursive enforcement project

The engine should be written and consumed as though committed runtime values are immutable snapshots. External mutation of values returned by the engine is unsupported and considered invalid consumer behavior.

Do **not** introduce:

- recursive cloning on `getSnapshot()`;
- a parallel readonly copy for React;
- a comprehensive deep-freeze pipeline over the entire config/runtime graph;
- wrappers around every returned item/event merely to defend hostile callers.

That cost is not justified for this game and would increase mental load, allocation pressure and architectural ceremony.

Cheap enforcement may be used where it provides value without spreading complexity, for example a development-only shallow/root freeze or focused freeze in tests. It is optional, not the target architecture.

### Required review invariant

All production mutations must still:

```text
enter through the engine write path
→ build a candidate runtime without mutating the committed graph in place
→ validate the candidate
→ commit one transition
```

Review must reject:

- in-place mutation inside `modifyRuntimeFx` callbacks;
- UI mutation of engine snapshots or command results;
- mutable caches derived from runtime and later treated as gameplay truth;
- code relying on consumer mutation as an API feature.

The engine is not required to defend itself against deliberate misuse of its returned objects. It is required to keep its own implementation clean and conventionally immutable.

## Decision B — `GameSession.run()` remains, guarded by convention and review

A fully closed command facade would prevent access to internal services more strongly, but it would also add a second API grammar, wrappers around existing Effects and another architectural layer that both humans and LLMs would need to navigate.

For now, `GameSession.run()` remains the generic runner.

Direct execution of internal store/context/layer operations from UI or ordinary consumers is unsupported and considered an architectural violation.

Do **not** introduce:

- command objects solely so an API can exist;
- wrapper methods duplicating every existing public Effect;
- branded/opaque command factories without a concrete need;
- a public-service onion that hides internals while making normal work harder to follow.

### Required review invariant

`src/v1/ui` and normal external consumers may run only documented public engine commands/reads. Review must reject use of:

- `RuntimeStoreFx`;
- `modifyRuntimeFx`;
- internal context/layer modules;
- domain-internal planners and write helpers;
- direct save/tick implementation services.

A focused architecture test may enforce import boundaries if it remains simple. Do not attempt to encode the entire semantic rule in a giant static-analysis contraption.

## Decision C — `createGameSession` must not keep a second asynchronous runtime truth

This remains a confirmed P1 defect.

The current topology is:

```text
canonical RuntimeStoreFx transition
        ↓ asynchronous bridge
local JavaScript `snapshot` mirror
```

A command can commit and resolve while `getSnapshot()` still returns the previous runtime. This is an actual internal/external split-brain failure, not a theoretical hostile-caller problem.

The session boundary must expose the same committed reference that the engine has already accepted. Subscriber notification may be asynchronous; the current readable value may not lag a completed command.

## Decision D — UI boundary stays thin and review-enforced

Do not build an elaborate read-model API merely because an API layer looks architecturally respectable.

The engine must remain standalone and complete. React, WebGL, react-three or any other renderer may:

- send public commands;
- subscribe to live engine state;
- subscribe to transient events;
- create pure presentation projections over engine-provided data.

UI may not implement gameplay/domain logic, including apparently trivial booleans whose answer belongs to the engine.

Examples that belong to the engine when they represent gameplay truth:

- whether a line can start;
- why an interaction is blocked;
- missing inputs;
- whether a resource is reserved;
- queue eligibility/capacity;
- effect-driven availability;
- accepted/rejected drop semantics.

Examples that may remain presentation projections:

- board coordinates to pixels or 3D transforms;
- grouping/sorting for a chosen visual layout;
- mapping an engine status to an icon or translated label;
- local hover, camera, animation interpolation and panel state.

Raw runtime selectors may remain. Review is responsible for detecting selectors that silently reconstruct gameplay decisions.

---

# Required implementation work

## P1 — Remove the asynchronous raw-runtime mirror from `createGameSession`

### Confirmed failure

`RuntimeStoreFx` owns canonical committed runtime, while `createGameSession` separately owns:

```ts
let snapshot = ...
```

A background transition consumer updates that variable later. `GameSession.run()` resolves on the internal commit, not on mirror synchronization.

Therefore this sequence is possible:

```text
command resolves
internal runtime = transition N+1
session.getSnapshot() = transition N
```

### Required target

There must be one synchronously readable current committed transition/reference for the framework-neutral session boundary.

Preferred mental model:

```text
serialized engine mutation
→ validate candidate
→ atomically replace current committed transition
→ command may resolve
→ listeners are notified in order
```

`getSnapshot()` must read that exact current committed transition directly. It must not read a separately synchronized raw-runtime variable.

### Implementation guidance

Keep the change focused. Valid approaches include:

- giving the canonical transition store a synchronous current-value read owned by the session/core boundary;
- replacing the `SubscriptionRef` + JS mirror topology with one small engine-owned committed-transition store that supports Effect mutation, synchronous reads and subscriptions;
- another equally direct design with one current transition reference and one serialized commit path.

Do not fix this by adding another ref, React state, clone or synchronization effect.

### Acceptance tests

- after `await session.run(publicCommand)`, `session.getSnapshot()` immediately returns the committed runtime;
- the guarantee holds while earlier listeners are still running;
- Tick commits update the same current reference;
- an event callback for transition N observes snapshot N or a clearly documented later snapshot, never an older one;
- session construction cannot lose the first committed transition;
- no second raw-runtime mirror remains in `createGameSession` or the React adapter.

---

## P2 — Stop runtime subscribers from being notified by event-only transitions

Current behavior notifies all runtime listeners for every committed transition, even when the runtime root reference is unchanged and only transient events were emitted.

Target:

```text
runtime reference changed
→ notify runtime subscribers

events emitted
→ notify event subscribers
```

This removes redundant synchronization without creating another source of truth.

### Acceptance tests

- event-only transition notifies event subscribers once;
- event-only transition notifies runtime subscribers zero times;
- runtime+event transition exposes the new snapshot before event delivery;
- runtime-only transition notifies only runtime subscribers.

---

## P2 — Isolate rejected async external callbacks

`invokeExternalCallbackFx` catches synchronous throws, but an `async` callback can return a rejected Promise that becomes an unhandled rejection and may kill surrounding infrastructure.

Choose a small explicit policy:

- callbacks are synchronous and returned PromiseLike values are detected and rejection-reported; or
- callbacks support `void | PromiseLike<void>` and rejection is isolated without blocking the transition consumer.

Do not await arbitrary UI work inline unless back-pressure semantics are intentionally chosen.

### Acceptance tests

- synchronous callback throw is reported and isolated;
- rejected async callback is reported and isolated;
- one broken callback does not stop later Tick/save/transition delivery;
- callback failure never becomes an unhandled rejection.

---

## P2 — Reduce `createGameSession` responsibility after fixing the truth split

`createGameSession` has reached the point where its responsibilities obscure the actual session contract:

- layer construction;
- command fiber ownership;
- transition/snapshot synchronization;
- runtime listeners;
- event listeners;
- save lifecycle;
- shutdown ordering.

The previous review repeatedly warned about this file, and the snapshot mirror eventually became a real correctness defect. It should now be simplified deliberately.

Do not split each closure into a separate helper or file.

Extract at most one or two coherent framework-neutral concepts, for example:

1. **Committed transition/session core**
   - owns current committed transition;
   - synchronous snapshot read;
   - ordered runtime/event subscriptions;
   - no React dependency.

2. **Session lifecycle orchestration**
   - owns command fibers, autosave and disposal ordering.

React context/hooks should remain a thin adapter over this object and must not own engine synchronization semantics.

### Acceptance criteria

- reading `createGameSession` no longer requires mentally tracking two runtime truths;
- the canonical commit path and subscriber delivery order are visible in one place;
- React owns no copy of engine state;
- no single-purpose wrapper explosion is introduced;
- existing small-`Fx` project grammar remains intact.

---

# Review-enforced guardrails

These are deliberate soft contracts. Do not turn them into infrastructure bloat unless repeated violations prove review insufficient.

## Engine mutation

Reject any code that:

- mutates committed runtime/config/event values in place;
- changes gameplay state outside the serialized engine write path;
- publishes external events before a successful state commit;
- consumes Tick/RNG/job lifecycle state separately from the transition it belongs to;
- keeps parallel internal representations that need manual synchronization.

## Engine ↔ UI boundary

Reject any UI code that:

- derives gameplay truth from raw runtime fields;
- stores a second copy of runtime in React state/ref;
- uses `useEffect` to synchronize engine state into another gameplay state;
- calls internal services through `GameSession.run()`;
- reconstructs state from transient events;
- treats a presentation projection as authoritative engine data.

Allow UI code that:

- maps already-decided engine data into visual shape;
- maintains purely presentational state;
- uses `useSyncExternalStore` or equivalent directly over the canonical session snapshot;
- reacts to transient events for animation/audio without deriving persistent gameplay state from them.

## Public API growth

When UI needs information not currently exposed:

1. first determine whether it is gameplay truth or merely presentation shape;
2. if gameplay truth, expose the smallest coherent engine read/projection needed;
3. do not create a generic API layer, DTO family or wrapper hierarchy pre-emptively;
4. keep the React bridge thin enough that review can inspect it quickly.

---

# Watch items

## Transient events retained in the latest transition

The current transition store retains its latest `{ runtime, events }` envelope. A newly attached low-level consumer could potentially observe stale transient events as an initial value.

No supported-session gameplay bug was reproduced. Keep this as a watch item until restartable/dynamic transition consumers exist. If it becomes real, solve it with sequence/cursor semantics, not by recreating a separate event source of truth.

## Mutable aliases

External mutation remains unsupported but technically possible. Escalate from soft contract to runtime enforcement only if repeated accidental violations occur despite review and tests.

## Generic `run()` capability

Direct internal-service execution remains technically possible. Escalate to a closed facade only if the codebase repeatedly violates the public-command convention or if the engine becomes a separately distributed third-party API with untrusted consumers.

---

# Recommended implementation order

1. Fix `createGameSession` so `getSnapshot()` reads the canonical committed transition synchronously.
2. Separate runtime-change notification from event-only notification.
3. Harden rejected async external callbacks.
4. Simplify `createGameSession` around one committed-transition/session-core concept without micro-helper proliferation.
5. Update architecture documentation with the soft-contract decisions above.
6. Add focused tests for the atomic engine ↔ external-world boundary.

Do not spend this slice on recursive deep freeze, command-facade redesign or a large read-model/API framework.

---

# Definition of done

This review is complete when:

- a completed command and `getSnapshot()` can never disagree;
- Tick, commands and load/start all update the same synchronously readable committed transition;
- React owns no raw-runtime mirror;
- event-only transitions do not wake runtime subscribers;
- rejected async callbacks cannot kill infrastructure;
- `createGameSession` has a clear, readable ownership model;
- documentation records mutable aliases and generic `run()` as deliberate soft contracts;
- review/architecture checks continue preventing engine logic from leaking into `src/v1/ui`;
- no new facade onion, recursive freeze pipeline or redundant synchronization layer is introduced.
