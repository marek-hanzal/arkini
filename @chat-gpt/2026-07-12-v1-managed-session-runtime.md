# V1 managed game session runtime

Current implementation: one canonical committed runtime with atomically attached transient events and listener-specific subscriptions.

## Final topology

One loaded game owns one long-lived `ManagedRuntime`.

```text
React / automation / debug
        │
        ├── public command/read Effect via GameSession.run
        ├── synchronous canonical runtime read via getSnapshot
        └── listener-specific runtime/event subscriptions
                    │
                    ▼
             ManagedRuntime
                    │
       GameSessionLayerFx
          ├── GameCoreLayerFx
          │     ├── GameConfigFx
          │     ├── RuntimeStoreFx
          │     │     ├── TRef<CommittedTransition>
          │     │     ├── TPubSub<CommittedTransition>
          │     │     └── one mutation-planning Semaphore
          │     ├── RuntimeFx
          │     ├── CommittedTransitionsFx
          │     └── TickFx
          └── GameLoopLayerFx
                └── scoped Schedule + Effect Clock Tick fiber
```

`RuntimeSchema` is the only gameplay truth. A committed transition is one atomically stored envelope:

```text
{
  runtime,
  events,
}
```

Events are transient metadata describing that exact successful runtime transition. They are not state, history, replay input or a second synchronization channel.

## Core mutation boundary

`RuntimeStoreFx` is one engine-owned committed-transition store built from Effect primitives. It owns exactly one current transition, one publication source and one semaphore used only to serialize mutation planning.

`modifyRuntimeFx` performs one serialized operation:

```text
acquire mutation-planning semaphore interruptibly
→ read current transition.runtime
→ build candidate runtime + ordered event metadata
→ validate candidate runtime
→ enter one non-yielding STM point of no return
     replace current { runtime, events }
     publish that same transition
     return command result
→ release mutation-planning semaphore
```

Planning and semaphore acquisition remain interruptible. Interruption before the accepted STM tail changes and publishes nothing. Once the STM tail starts, current replacement, publication and the command result are one atomic transaction with no asynchronous boundary between them. A no-op mutation with no events preserves transition identity and therefore publishes nothing.

Committed runtime values are treated as immutable snapshots by convention. Production mutations must enter through the engine write path and create a candidate graph without mutating the committed graph in place. Recursive clone/freeze infrastructure is intentionally not part of this architecture.

## Atomic transition subscriptions

`CommittedTransitionsFx.subscribe` opens one scoped subscription returning:

```text
current committed transition captured at registration
+ every later transition in commit order
+ an immediate subscription shutdown Effect
```

The store performs registration in one STM transaction independent of long mutation planning:

```text
read current TRef
+ subscribe one TQueue to the TPubSub
→ commit both atomically
```

This creates one explicit linearization point without a revision counter, readiness latch, mirror or registration marker:

```text
transition committed before subscription registration
→ captured as current; not part of changes

transition committed after subscription registration
→ queued in changes exactly once
```

The acquisition contains no asynchronous boundary, does not wait for an in-flight mutation planner, and can be completed through `ManagedRuntime.runSync`, which is required by React's synchronous `subscribe()` contract.

## Browser/UI integration

`createGameSession` stores no JavaScript runtime mirror.

```text
GameSession.getSnapshot
→ ManagedRuntime.runSync(readRuntimeFx())
→ canonical RuntimeStoreFx transition.runtime
```

Therefore a completed command and `getSnapshot()` cannot disagree. Callback delivery may happen later; the synchronously readable runtime cannot lag the accepted commit.

`GameSessionTransitionSubscriptionsFx` is a factory for listener-specific child scopes. It does not own a central transition consumer or mutable listener sets.

For each runtime listener:

```text
open atomic current + tail subscription
→ use current.runtime as identity baseline
→ notify only for later changed runtime roots
```

For each event listener:

```text
open atomic current + tail subscription
→ ignore captured current
→ deliver events only from later transitions
```

Unsubscribe synchronously shuts down that listener's `TQueue` before its child scope is released. Closing the session scope closes every remaining listener subscription and command fiber.

There is intentionally no global callback ordering guarantee between independent runtime and event subscribers. The truthful invariant is:

```text
transition is canonical and synchronously readable
→ then independent subscribers may be notified
```

An event callback reads the runtime of its transition or a later commit, never an older snapshot.

### Presentation lag is intentional

The engine never waits for React rendering or animation completion. UI presentation may deliberately show an older or intermediate visual state while canonical runtime continues committing newer gameplay truth.

- animation queues are local presentation state;
- new engine events may redirect, shorten, merge or skip ongoing animations;
- presentation state must never become gameplay truth;
- a new subscriber does not replay an old engine event merely because another UI surface is still animating it.

A renderer that needs a specific DOM/animation handoff must implement that handoff inside the presentation layer. Runtime-before-event callback ordering cannot honestly guarantee React commit timing.

### React boundary

- `GameSessionProvider` provides one stable session.
- `useRuntimeSelector` adapts the canonical snapshot through `useSyncExternalStore`.
- `useGameCommand` runs documented public engine Effects against the same runtime.
- `useGameEvents` observes transient metadata for animation, audio or telemetry.

UI may create pure presentation projections such as coordinates, labels, icons, grouping and local animation state. UI may not reconstruct gameplay truth such as start eligibility, missing inputs, reservation state, queue capacity or accepted drop semantics.

`GameSession.run()` remains generic by deliberate soft contract. UI and normal consumers may run public engine commands/reads only. Direct imports of core `internal` modules from `src/v1/ui` and imports of UI modules from v1 core are architecture violations enforced by Dependency Cruiser and focused tests.

## Save

`RuntimeSaveLayerFx` consumes its own atomic committed-transition subscription.

```text
current transition + later transitions
→ project transition.runtime
→ deduplicate by runtime root identity
→ debounce
→ flush latest canonical runtime
```

Consequences:

- the captured current runtime may produce an explicit initial save;
- rapid runtime changes remain coalesced;
- event-only transitions neither wake nor postpone autosave;
- actual writes are serialized;
- flush always reads the latest canonical runtime;
- failed mutations publish nothing and therefore trigger no save;
- save never derives gameplay state from transient events.

Duplicate saves remain acceptable.

## External callback isolation

Browser/user callbacks are outside the engine failure boundary. Tick reporting, save reporting, runtime listeners and event listeners explicitly accept `void | PromiseLike<void>` and run through `invokeExternalCallbackFx`.

- synchronous throws are logged and swallowed;
- returned PromiseLike values are observed without awaiting them inline;
- rejected PromiseLike values are logged and swallowed;
- one slow or broken callback cannot terminate Tick, save or another subscription;
- callback failures never become unhandled promise rejections.

This remains best-effort delivery. Gameplay truth is already committed before presentation callbacks run.

## Tick and shutdown

The production loop uses Effect Schedule and Effect Clock. Gameplay jobs use fixed-step `remainingMs`; no job wall-clock timestamps exist.

Session shutdown order:

```text
reject new GameSession.run calls
→ stop production Tick loop
→ close session scope (command fibers + listener child scopes)
→ flush the latest stable runtime
→ dispose ManagedRuntime
```

The first `dispose()` call owns one memoized cleanup Promise. Every concurrent or later caller receives that same Promise and observes the real completion or failure.

## Explicit non-decisions

Do not introduce by default:

- a second raw-runtime mirror in JavaScript or React state;
- a central callback fanout whose listener membership is evaluated after commit;
- recursive clone/deep-freeze pipelines;
- a wrapper method or command object for every public Effect;
- global engine command/output queues;
- separate runtime and event sources of truth;
- readiness flags or latches around lazy streams;
- persisted/global revisions solely for subscription registration;
- gameplay state reconstructed from transient events;
- a generic DTO/read-model hierarchy without a concrete gameplay need.

Escalate the soft immutability or generic-run contracts only after repeated real violations prove focused review and architecture tests insufficient.
