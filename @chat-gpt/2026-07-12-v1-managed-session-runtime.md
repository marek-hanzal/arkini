# V1 managed game session runtime

Implementation baseline: `3f22ec50`

Follow-up integration cleanup: pending commit

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
          │     ├── SubscriptionRef runtime store
          │     ├── RuntimeFx
          │     ├── RuntimeChangesFx
          │     ├── TickFx
          │     └── GameEventsFx / PubSub
          └── GameLoopLayerFx
                └── scoped Schedule + Effect Clock tick fiber
```

`RuntimeSchema` remains the only gameplay truth. Effect live objects are session infrastructure reconstructed when a game is loaded.

## Layer ownership

### `GameCoreLayerFx`

Owns deterministic game services without background work.

Use it through `GameLayerFx` / `useGameFx` in tests and composed programs where Tick is controlled manually.

The runtime store is now `SubscriptionRef<RuntimeSchema.Type>`, while `RuntimeStoreFx` and `modifyRuntimeFx` remain the only mutation boundary.

`RuntimeChangesFx` exposes committed snapshots and filters same-reference no-op commits so an idle Tick does not invalidate React or trigger save work.

### `GameLoopLayerFx`

Owns one scoped production Tick fiber.

- cadence defaults to 200 ms;
- cadence uses `Schedule.spaced`;
- elapsed gameplay time always comes from Effect Clock through `pulseTickFx`;
- a sleeping browser tab therefore produces one long real-time Tick after wake;
- one failed Tick does not kill the loop;
- failed Tick restores the previous Tick snapshot so elapsed time is retried instead of silently discarded.

### `GameSessionLayerFx`

Combines one core and one production loop. The loop is disposed with the session scope.

## Browser/UI integration

Everything that directly adapts engine services for React or browser session ownership lives under:

```text
src/v1/ui/<domain>
```

Core v1 code must not import from `src/v1/ui` and React imports are restricted to that tree by `V1UiBoundary.test.ts`.

### `createGameSession`

Creates one `ManagedRuntime` and exposes a stable `GameSession`:

```text
getSnapshot()
subscribe(listener)
run(effect)
subscribeEvents(listener)
flushSave()
dispose()
```

The same runtime is used by UI commands, Tick, save and events. Never rebuild the game layer per React render or command.

The session acquires its PubSub subscription before being exposed, so the first command cannot outrun the event consumer.

The synchronous snapshot is loaded before subscriptions start. The runtime stream drops its initial current-value emission because React already owns that exact snapshot; attaching a subscriber must not manufacture a fake runtime change or gratuitous render.

Session shutdown has one explicit order:

```text
stop production Tick loop
→ stop UI runtime/event bridges
→ close the event subscription
→ flush the latest stable runtime
→ dispose the ManagedRuntime
```

The Tick loop must stop before the final save starts. Otherwise a slow save could serialize one snapshot while the still-running loop commits a newer runtime, leaving disposal dependent on racing layer finalizers.

### React

- `GameSessionProvider` provides one stable session.
- `useRuntimeSelector` adapts committed runtime state through `useSyncExternalStore` and preserves selected values through equality checks.
- `useGameCommand` adapts a public Effect command to a React callback while keeping direct typed command results/errors.
- `useGameEvents` subscribes a session-level presentation coordinator to transient event batches.

State and events stay separate:

```text
RuntimeChangesFx → current truth for board, inventory, jobs and progress
GameEventsFx     → one-shot facts for animation, sound and telemetry
```

## Save

`RuntimeSaveLayerFx` lives under `src/v1/ui/save` because it is session/browser integration, not gameplay logic.

- consumes committed runtime snapshots;
- skips the initial stream emission;
- debounces rapid Tick commits;
- serializes runtime through `fromRuntimeFx`;
- failed mutations emit no snapshot and therefore trigger no save;
- explicit flush and session disposal persist the latest committed runtime;
- duplicate flushes of the same runtime object are suppressed;
- no decorative pending-state mirror is kept: flush reads the current canonical runtime and compares it with the last successfully saved snapshot.

The save port is an Effect callback. Dexie can implement that port later without entering engine domains.

## Transient events

`modifyRuntimeFx` may receive an optional ordered event list from the mutation callback.

The mutation boundary performs:

```text
build candidate runtime + events
→ validate candidate
→ commit SubscriptionRef
→ publish one event batch
→ return command result
```

A rolled-back candidate publishes nothing. Publication is best-effort presentation infrastructure and is never required for gameplay correctness.

The event bus uses a sliding PubSub with bounded transient capacity. There is no global output Queue.

Currently emitted semantic events:

- `job:started` with `explicit` or `queue` source;
- `job:completed`.

Long Tick processing emits one ordered batch containing the whole completed/started chain.

Future item, merge and placement events should extend `GameEventSchema`; they must still publish only after successful commit.

## Explicit non-decisions

Do not introduce by default:

- global `Queue<EngineCommand>`;
- global engine output Queue;
- `Deferred` command responses;
- fibers, sleeps or latches per gameplay job;
- save driven by transient events;
- UI state reconstructed from events.

A UI animation or sound subsystem may introduce its own local Queue only after a concrete sequencing/back-pressure requirement exists.

## Tests added

- one ManagedRuntime persists command state and updates synchronous UI snapshots;
- attaching React subscribers does not emit a fake initial change;
- no-op Tick does not notify React subscribers;
- production scoped Tick loop completes a job from Effect Clock;
- explicit and queued jobs publish ordered event batches;
- invalid candidate rollback publishes no event;
- save debounces committed snapshots;
- failed mutation triggers no save;
- dispose stops the production Tick loop before flushing the latest stable runtime;
- architecture prevents React/UI dependency leakage into core v1.
