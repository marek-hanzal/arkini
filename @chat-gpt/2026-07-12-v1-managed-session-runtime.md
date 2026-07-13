# V1 managed game session runtime

Current implementation: atomically committed runtime transitions.

## Final topology

One loaded game owns one long-lived `ManagedRuntime`.

```text
React / automation / debug
        │
        ├── typed command Effect via GameSession.run
        ├── synchronous runtime snapshot + subscribe
        └── transient event subscription
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

`RuntimeSchema` remains the only gameplay truth. A committed transition is one atomically stored envelope:

```text
{
  runtime,
  events,
}
```

Events are transient metadata describing that exact committed runtime transition. They are not a second history, a second state store or a gameplay input.

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

There is no core event PubSub, separate event publisher or output Queue.

## Browser/UI integration

Everything that directly adapts engine services for React or browser session ownership lives under:

```text
src/v1/ui/<domain>
```

`createGameSession` owns one committed-transition bridge. For each emission it always performs:

```text
set synchronous runtime snapshot
→ notify runtime listeners
→ notify event listeners when events are present
```

Therefore an event listener always observes the runtime snapshot committed with that event batch. Runtime and event ordering cannot diverge because they travel through the same transition stream.

The stream's initial current-value emission is processed normally. A duplicate initial notification is harmless and preferred over dropping a real commit that races session construction.

### React

- `GameSessionProvider` provides one stable session.
- `useRuntimeSelector` adapts the latest committed runtime through `useSyncExternalStore`.
- `useGameCommand` runs typed Effect commands against the same session runtime.
- `useGameEvents` observes transient metadata from the same committed-transition bridge.

UI state must always be read from the runtime snapshot. Events may trigger animation, sound or telemetry but never reconstruct gameplay state.

## Save

`RuntimeSaveLayerFx` consumes the same committed-transition stream.

- the initial emission may produce an initial save;
- duplicate saves are acceptable;
- rapid transitions are debounced;
- actual writes are serialized;
- flush always reads the latest canonical runtime;
- failed mutations emit no transition and therefore trigger no save.

Save never depends on transient events.

## Tick and shutdown

The production loop uses Effect Schedule and Effect Clock. Gameplay jobs use fixed-step `remainingMs`; no job wall-clock timestamps exist.

`TickFx` cursor state is transient session infrastructure:

- an incomplete fixed-step remainder of at most 199 ms may be discarded on dispose;
- a budget retained after an unexpected Tick failure is retried only within that live session and is discarded on dispose or reload;
- neither value belongs in `RuntimeSchema`, save state, or job timestamps.

Session shutdown order remains:

```text
reject new GameSession.run calls
→ stop production Tick loop
→ interrupt and await session-owned command fibers
→ stop the committed-transition bridge
→ flush the latest stable runtime
→ dispose ManagedRuntime
```

The first `dispose()` call owns one memoized cleanup Promise. Every concurrent or later caller receives that same Promise and therefore observes the real completion or failure of the one shutdown operation. No caller may resolve merely because disposal has already started.

## External callback isolation

User/browser callbacks are outside the engine failure boundary. Tick reporting, save reporting, runtime listeners and event listeners run through `invokeExternalCallbackFx`. A callback defect is logged and swallowed so that:

- one broken reporter does not terminate Tick or autosave retry;
- one broken listener does not prevent remaining listeners from receiving the transition;
- the committed-transition consumer remains alive for later commits.

This is best-effort delivery only. Gameplay truth remains in the committed runtime even when one presentation callback fails.

## Explicit non-decisions

Do not introduce by default:

- global `Queue<EngineCommand>`;
- global engine output Queue;
- core PubSub duplicating committed transitions;
- `Deferred` command responses;
- fibers, sleeps or latches per gameplay job;
- UI or save state reconstructed from events.

A concrete animation or audio subsystem may introduce its own local Queue only when it has a demonstrated sequencing or back-pressure requirement.
