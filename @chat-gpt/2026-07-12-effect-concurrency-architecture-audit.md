# Effect concurrency architecture audit

Snapshot: `628c17b9`
Effect: `3.21.4` from `package-lock.json`
Scope: v1 runtime, tick, future React UI integration, save subsystem and sound/event delivery.

## Executive decision

Use Effect concurrency primitives around the canonical persisted runtime, not as a second representation of gameplay state.

Adopt:

1. `ManagedRuntime` as the lifetime boundary for one loaded game session.
2. `Schedule` plus one scoped fiber as the production tick driver.
3. `SubscriptionRef` as the runtime store once UI/save integration begins.
4. `PubSub` for committed transient domain-event batches once v1 event schemas exist.

Keep:

- plain serializable jobs with `remainingMs`;
- plain serializable queued start requests;
- `modifyRuntimeFx` as the only mutation gateway;
- Effect `Clock` as the only production clock;
- direct typed public command effects for UI and automation.

Do not introduce now:

- a global `Queue<EngineCommand>`;
- `Deferred` for gameplay jobs or command responses;
- a fiber, latch or sleep operation per gameplay job;
- Effect `Queue` as the persisted gameplay queue;
- state reconstruction from transient events.

## Current repository facts

### The runtime already has the correct serialization primitive

`RuntimeStoreFx` stores `SynchronizedRef<RuntimeSchema.Type>` and `modifyRuntimeFx` owns every public mutation through `SynchronizedRef.modifyEffect`.

The update runs against one locked snapshot, nested `RuntimeFx` reads are pinned to that snapshot, the candidate is validated, and only then is it committed.

A global command queue would duplicate mutation serialization rather than replace missing serialization.

### The current game layer is scoped to one Effect program

`useGameFx` provides a freshly built `GameLayerFx` to one Effect program. This is ideal for tests and composed standalone programs.

It is not yet the browser-session adapter. Running every UI command through a new `useGameFx({ config })` invocation would construct a new runtime store and reset the game.

The UI therefore needs one long-lived Effect runtime per loaded game.

### Runtime reads and runtime notifications are currently separate missing concerns

`RuntimeFx` exposes only an Effectful immutable read. No v1 notification stream or React adapter exists yet.

React needs:

- a synchronous `getSnapshot` for `useSyncExternalStore`;
- a subscription callback;
- typed imperative commands whose results and errors return to the caller.

Save needs committed runtime changes, but should debounce them because active jobs may commit on every tick.

Sound and one-shot animation need transient semantic events, not state diffs.

These are related integration concerns but not one data channel.

## Primitive decisions

## `ManagedRuntime`: adopt

### Problem solved

One loaded game needs one service graph and one resource scope shared by:

- UI commands;
- UI reads/subscriptions;
- tick driver;
- autosave;
- sound/event consumers;
- eventual restore and teardown.

### Proposed role

Create one `ManagedRuntime` from the game-session layer when a game is loaded and dispose it when that session is closed.

All UI and subsystem effects run through this same runtime.

### Recommended boundary

A browser-facing `GameSession` adapter should expose approximately:

```text
readSnapshot(): RuntimeSchema.Type
subscribe(listener): () => void
run(effect): Promise<Result>
dispose(): Promise<void>
```

The concrete UI API may wrap public commands instead of exposing a fully generic `run`, but it must use one managed runtime internally.

### Important constraint

Do not make React own individual Effect services or rebuild layers per component/render. React receives one stable session object.

## `Schedule` + scoped fiber: adopt for the tick driver

### Problem solved

The browser needs a periodic impulse without manual interval handles, cleanup booleans or timer ownership leaking into React.

### Proposed flow

```text
scoped game session
→ one tick-loop fiber
→ Schedule.spaced(configured cadence)
→ pulseTickFx using Effect Clock
→ runTickRuntimeFx
```

`Schedule` defines only wake cadence. It does not define elapsed gameplay time.

After a sleeping tab wakes late, `pulseTickFx` reads Effect Clock and produces the full real elapsed duration. The existing long-tick engine may then complete the active job and any number of queued requests.

### Why `spaced`, not `fixed`

`spaced` waits from the end of one tick execution before scheduling the next pulse. It cannot produce an immediate catch-up loop merely because one runtime tick took longer than the nominal cadence.

The game already accounts for real elapsed time, so fixed wall cadence provides no simulation benefit.

### Layer boundary

Do not start the loop unconditionally inside the core `GameLayerFx` used by tests.

Prefer:

```text
GameCoreLayerFx
  config + runtime + TickFx

GameLoopLayerFx
  scoped tick fiber, requires core services

GameSessionLayerFx
  core + loop + future UI/save/event consumers
```

Tests can provide only the core layer and set Tick locally.

### Error policy

One failed tick must not silently kill the loop fiber forever.

Each pulse should capture/report its failure and continue to the next scheduled pulse. Failed runtime transitions already rollback atomically.

The eventual error channel may be logging plus a transient engine event. It must not be persisted as gameplay state unless the domain explicitly needs it.

## `SubscriptionRef`: adopt when UI/save integration lands

### Verified compatibility

In Effect 3.21.4, `SubscriptionRef<A>` extends `SynchronizedRef<A>` and exposes a `changes: Stream<A>` containing the current value plus subsequent updates.

It can therefore replace the concrete runtime store without replacing `modifyRuntimeFx` or weakening transaction semantics.

### Problems solved

- one native stream of successfully committed runtime snapshots;
- UI invalidation without adding notifications to every command;
- autosave input without polling;
- future debug/runtime inspectors.

### Recommended service split

Do not add `changes` directly to the current `RuntimeFx` service.

`modifyRuntimeFx` intentionally overrides `RuntimeFx.read` inside a transaction so nested reads see the locked snapshot. A combined read/subscription service would make that override awkward and expose meaningless subscription behavior inside a mutation.

Prefer:

```text
RuntimeFx
  read current immutable snapshot

RuntimeChangesFx
  changes stream of committed snapshots

RuntimeStoreFx (internal)
  SubscriptionRef<RuntimeSchema.Type>
```

### React adapter

`SubscriptionRef` does not directly satisfy `useSyncExternalStore`, which requires synchronous snapshot access.

The session adapter should:

1. obtain the initial runtime before exposing the session;
2. keep the latest committed snapshot in a plain synchronous field;
3. run one scoped stream consumer that updates the field and notifies React listeners;
4. expose `readSnapshot` and `subscribe` to `useSyncExternalStore`;
5. use selector-based hooks so every 200 ms tick does not rerender the entire application tree.

Do not spawn one Effect stream fiber per React component.

### Save consumer

Autosave should consume `RuntimeChangesFx.changes`, skip or deliberately handle the initial emission, debounce/coalesce rapid tick changes, transform runtime to `StateSchema`, and persist sequentially.

The save stream is state-based. It must not depend on transient domain events.

### Back-pressure and cadence

Tick mutations can update runtime frequently. UI notification should remain cheap, and save must debounce. The runtime stream is not a command queue and must not contain work requests.

## `PubSub`: adopt later for committed transient event batches

### Problems solved

Sound, one-shot animations, analytics and debugging need semantic facts such as:

```text
job completed
item spawned
merge succeeded
input rejected
```

Deriving these from runtime diffs is ambiguous and expensive. Storing them in runtime would replay stale sounds and animations after reload.

### Correct role

Publish ephemeral event batches only after a runtime mutation has successfully committed.

Every current subscriber receives the batch; future subscribers do not replay historical events.

### Mutation integration

Do not publish from planners or before candidate validation.

The mutation boundary should eventually support an internal result envelope such as:

```text
{
  result,
  events
}
```

`modifyRuntimeFx` commits the validated runtime first and then publishes the event batch through a `GameEventsFx` service.

Public commands still return their current typed result.

### Batch rather than individual messages

One long tick can complete multiple jobs and generate many related events. Publish one ordered event batch per committed runtime transaction.

This gives sound and animation consumers enough context to deduplicate, cap or sequence effects without affecting gameplay atomicity.

### Subscriber roles

Use PubSub for:

- sound planner/player;
- one-shot UI animation/effect coordinator;
- optional telemetry/debug tracing.

Do not use PubSub for:

- current board/inventory rendering;
- save persistence;
- gameplay queue state;
- anything that must survive reload or subscriber absence.

### Buffer policy

Do not use bounded back-pressure that can block a gameplay commit behind a slow sound subscriber.

Start with an unbounded or intentionally lossy transient event hub, chosen when event volume and UI behavior are known. Given current expected event volume, an unbounded batch hub is the simplest initial policy, with a future safety cap if profiling justifies it.

## `Queue`: reject as a global engine command bus for now

### Why it initially looks attractive

UI, automation and tick all send impulses to the engine, and Queue provides FIFO delivery and back-pressure.

### Why it is not justified today

The existing `SynchronizedRef.modifyEffect` already serializes all runtime mutations.

A command queue would additionally require:

- a command envelope;
- a permanent consumer fiber;
- request/result correlation;
- typed error routing back to the initiating UI action;
- shutdown behavior;
- likely one Deferred per request;
- decisions about queued reads versus direct reads;
- handling a dead consumer while callers wait.

This adds a second scheduling layer without removing the mutation gateway.

### UI and automation path

Use direct public command effects through the shared `ManagedRuntime`:

```text
UI click ─────────┐
automation ───────┼→ same public command Fx → modifyRuntimeFx
tick loop ────────┘
```

The shared internal start pipeline remains the authority for explicit UI starts and queue dispatch inside tick processing.

### When to re-evaluate Queue

Only reconsider a command queue if a concrete requirement appears for:

- accepting commands while the engine runtime is temporarily unavailable;
- explicit bounded back-pressure from external producers;
- coalescing or prioritizing external impulses before execution;
- transport across a Worker boundary;
- recording/replaying a command log.

None of these requirements currently exists.

### Possible subsystem-local use

A future sound subsystem may use an internal queue if WebAudio sequencing genuinely requires one. That is an implementation detail of sound, not an engine-wide command architecture.

## `Deferred`: reject for current architecture

### Verified semantics

Deferred is a one-time asynchronously completed value. Fibers may await it until another fiber completes it once with success or failure.

### Current candidate cases and verdicts

#### Gameplay job

Reject. Runtime job state is persisted, pausable, inspectable and completed through atomic tick transitions. Deferred cannot represent this and would create a second non-persisted job identity.

#### UI command response

Reject because the global command queue is rejected. `ManagedRuntime.runPromise(commandFx)` already returns the typed result or error to the caller.

#### Game bootstrap readiness

Reject. Creating/awaiting the game session and ManagedRuntime already represents bootstrap completion.

#### Save flush

Reject today. The save effect itself is awaitable. A Deferred is only useful if an independently running save fiber must expose one completion signal to unrelated waiters.

#### Tests

Use only for genuinely concurrent synchronization tests where one fiber must wait for another fiber-controlled milestone. Current deterministic Tick tests do not need it.

### Admission rule

Introduce Deferred only when all are true:

1. one operation is started independently of its waiter;
2. one immutable completion result must be delivered once;
3. direct effect composition or awaiting the original effect is impossible or materially worse;
4. the signal is transient and need not survive reload.

No current production use case satisfies this test.

## Other primitives

### `Ref`

Keep for TickFx. Tick is transient session infrastructure, not persisted gameplay truth.

The loop must read one tick snapshot and use it for the whole runtime transition. Do not read a changing Ref repeatedly inside one tick.

### `SynchronizedRef`

Keep conceptually as the mutation mechanism. SubscriptionRef is its observable subtype, not a replacement architecture.

### Fibers

Use a small fixed number of session-owned scoped fibers:

- tick loop;
- runtime-to-React adapter consumer;
- autosave consumer;
- event consumers such as sound.

Do not create a fiber per gameplay job.

### Latch / Semaphore

Do not introduce. Paused jobs are persisted domain state derived during Tick, not blocked fibers. Mutation serialization is already owned by the synchronized runtime reference.

## Target topology

```text
React UI
  │
  ├── synchronous readSnapshot / subscribe
  │          ▲
  │          │ one adapter consumer
  │    RuntimeChangesFx (SubscriptionRef stream)
  │
  └── typed command methods
             │
Automation ──┼──────────────┐
             ▼              │
      ManagedRuntime        │
             │              │
Tick Schedule + fiber ──────┘
             │
       public command Fx / runTickRuntimeFx
             │
       modifyRuntimeFx
             │
  SubscriptionRef<Runtime>
             │
             ├── committed runtime stream → UI
             └── committed runtime stream → debounced save

modifyRuntimeFx successful commit
             │
             ▼
      PubSub<GameEventBatch>
             ├── sound
             ├── one-shot UI effects
             └── debug/telemetry
```

No command Queue and no Deferred are present in the default topology.

## Recommended implementation order

### Phase 1: session and tick lifetime

1. Split core game services from optional production loop layer.
2. Add one scoped Schedule-based tick fiber using `pulseTickFx` and `runTickRuntimeFx`.
3. Add a long-lived browser `GameSession` backed by `ManagedRuntime`.
4. Ensure disposal interrupts all scoped fibers and releases subscribers.
5. Keep tests on the core layer with manually controlled TickFx.

### Phase 2: observable state and React/save integration

1. Change the concrete runtime store to `SubscriptionRef`.
2. Preserve `RuntimeStoreFx` and `modifyRuntimeFx` boundaries.
3. Add `RuntimeChangesFx` as a read-only changes stream.
4. Build one React external-store adapter with selector hooks.
5. Build one debounced sequential autosave consumer.
6. Test that failed mutations emit no runtime change and trigger no save.

### Phase 3: transient events and sound

1. Define v1 domain event schemas.
2. Extend the internal mutation result with an event batch.
3. Publish only after successful commit.
4. Add `GameEventsFx` backed by PubSub.
5. Build sound and one-shot UI consumers.
6. Test that rollback publishes no event and one long tick publishes one ordered batch.

### Explicitly not scheduled

- global command Queue;
- Deferred infrastructure;
- per-job fibers/sleeps/latches;
- command event sourcing;
- Worker transport.

## Guardrails

- RuntimeSchema remains the only gameplay truth.
- Effect live objects are reconstructible session infrastructure only.
- UI reads state; it does not rebuild state from events.
- Saves consume committed state; they do not consume events.
- Sound consumes events; it does not infer semantics from state diffs.
- Public commands remain directly awaitable and typed.
- Tick cadence never replaces Effect Clock elapsed time.
- No primitive is introduced without deleting concrete complexity or satisfying a demonstrated requirement.
