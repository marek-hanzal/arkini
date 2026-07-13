# V1 managed game session runtime

Current implementation: one canonical committed runtime with atomically attached transient events.

## Final topology

One loaded game owns one long-lived `ManagedRuntime`.

```text
React / automation / debug
        │
        ├── public command/read Effect via GameSession.run
        ├── synchronous canonical runtime read via getSnapshot
        └── runtime invalidation + transient event subscriptions
                    │
                    ▼
             ManagedRuntime
                    │
       GameSessionLayerFx
          ├── GameCoreLayerFx
          │     ├── GameConfigFx
          │     ├── SubscriptionRef<CommittedTransition>
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

`RuntimeStoreFx` owns one `SubscriptionRef<CommittedTransition>`.

`modifyRuntimeFx` performs one serialized operation:

```text
read current transition.runtime
→ build candidate runtime + ordered event metadata
→ validate candidate runtime
→ atomically commit { runtime, events }
→ return command result
```

A failed candidate commits neither runtime nor events. A no-op mutation with no events preserves the same transition reference and therefore emits no change.

Committed runtime values are treated as immutable snapshots by convention. Production mutations must enter through the engine write path and create a candidate graph without mutating the committed graph in place. Recursive clone/freeze infrastructure is intentionally not part of this architecture.

## Atomic transition subscriptions

`CommittedTransitionsFx` does not expose a bare lazy stream. It opens one scoped subscription returning:

```text
current committed transition
+ every later transition in commit order
```

The `current + changes` pair is acquired atomically from `SubscriptionRef.changes` through `Stream.peel`. There is no registration gap and no readiness boolean, latch, mirror ref or parallel event source.

Consumers explicitly choose how to use the pair:

- session delivery uses `current.runtime` only as its notification baseline and consumes later transitions;
- autosave consumes `current` followed by later transitions so initial save behavior remains explicit;
- closing the owning Effect scope closes the subscription and its consumer together.

## Browser/UI integration

`createGameSession` no longer stores a JavaScript runtime mirror.

```text
GameSession.getSnapshot
→ ManagedRuntime.runSync(readRuntimeFx())
→ canonical RuntimeStoreFx transition.runtime
```

Therefore a completed command and `getSnapshot()` cannot disagree. Subscriber delivery may still happen later; the synchronously readable runtime cannot lag the accepted commit.

`GameSessionTransitionBridgeFx` owns only framework-neutral callback delivery:

```text
runtime reference changed
→ notify runtime subscribers

events present
→ notify event subscribers
```

Runtime callbacks run before event callbacks for one transition. Event-only transitions do not wake React/runtime subscribers. The bridge keeps only a private delivery cursor used to compare runtime root references; it is not readable gameplay state.

The session scope owns both command fibers and the transition bridge. Shutdown closes that one scope instead of manually coordinating unrelated fibers.

### React boundary

- `GameSessionProvider` provides one stable session.
- `useRuntimeSelector` adapts the canonical snapshot through `useSyncExternalStore`.
- `useGameCommand` runs documented public engine Effects against the same runtime.
- `useGameEvents` observes transient metadata for animation, audio or telemetry.

UI may create pure presentation projections such as coordinates, labels, icons, grouping and local animation state. UI may not reconstruct gameplay truth such as start eligibility, missing inputs, reservation state, queue capacity or accepted drop semantics.

`GameSession.run()` remains generic by deliberate soft contract. UI and normal consumers may run public engine commands/reads only. Direct imports of core `internal` modules from `src/v1/ui` are architecture violations and are guarded by focused source checks.

## Save

`RuntimeSaveLayerFx` consumes its own atomic committed-transition subscription.

- the captured current transition may produce an initial save;
- rapid later transitions are debounced;
- actual writes are serialized;
- flush always reads the latest canonical runtime;
- failed mutations emit no transition and therefore trigger no save;
- save never derives gameplay state from transient events.

Duplicate saves remain acceptable.

## External callback isolation

Browser/user callbacks are outside the engine failure boundary. Tick reporting, save reporting, runtime listeners and event listeners explicitly accept `void | PromiseLike<void>` and run through `invokeExternalCallbackFx`.

- synchronous throws are logged and swallowed;
- returned PromiseLike values are observed without awaiting them inline;
- rejected PromiseLike values are logged and swallowed;
- one slow or broken callback cannot block remaining listeners or terminate Tick, save or transition infrastructure;
- callback failures never become unhandled promise rejections.

This remains best-effort delivery. Gameplay truth is already committed before presentation callbacks run.

## Tick and shutdown

The production loop uses Effect Schedule and Effect Clock. Gameplay jobs use fixed-step `remainingMs`; no job wall-clock timestamps exist.

Session shutdown order:

```text
reject new GameSession.run calls
→ stop production Tick loop
→ close session scope (command fibers + transition bridge)
→ flush the latest stable runtime
→ dispose ManagedRuntime
```

The first `dispose()` call owns one memoized cleanup Promise. Every concurrent or later caller receives that same Promise and observes the real completion or failure.

## Explicit non-decisions

Do not introduce by default:

- a second raw-runtime mirror in JavaScript or React state;
- recursive clone/deep-freeze pipelines;
- a wrapper method or command object for every public Effect;
- global engine command/output queues;
- separate runtime and event sources of truth;
- readiness flags or latches around lazy streams;
- gameplay state reconstructed from transient events;
- a generic DTO/read-model hierarchy without a concrete gameplay need.

Escalate the soft immutability or generic-run contracts only after repeated real violations prove focused review and architecture tests insufficient.
