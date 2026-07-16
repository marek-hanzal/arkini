# Arkini architecture

This document is the canonical technical architecture. It describes the implemented engine, not an aspirational rewrite.

Engine paths are relative to `src/engine` unless written explicitly. `src/bridge` is the only legal connection from React to public engine contracts and mirrors concrete domains as `bridge/<domain>/<operation>`. Reusable presentation and transient interaction code lives under `src/ui`; route-level composition lives under `src/page`; TanStack Router file registrations live under `src/@routes`. Renderer dependency direction is `@routes → page → ui → bridge → engine`. `electron/` owns only Electron main/preload/protocol concerns and may not import renderer or engine roots. The renderer may not import Electron. `src/_archive` is outside every active source root and may never be imported.

## 0. Desktop host boundary

Electron is a thin sibling platform adapter, not another application or another game owner.

```text
electron/main + electron/preload
→ BrowserWindow, custom protocol, controlled close, typed Arkpack/save filesystem capabilities

src/@routes → src/page → src/ui → src/bridge → src/engine
→ the only renderer, route tree, game bridge, and engine
```

Development Electron loads the Vite HTTP origin for HMR. Packaged Electron registers `arkini` as a privileged standard secure scheme and serves the same renderer from `arkini://app/*`. TanStack Router uses standard browser history in both environments: `/` is the Arkpack selector and `/game/$packageId` owns one live game. Electron does not interpret routes beyond static resource serving and SPA fallback.

Main/preload do not own game state, package semantics, save codec semantics, or Tick. Renderer domains do not import Electron or Node platform APIs. The shared `desktop/ArkiniDesktopApi.ts` contract exposes only concrete Arkpack bytes/metadata, opaque save bytes, and controlled-close signals. Physical paths are derived exclusively in Electron main; the renderer cannot request arbitrary filesystem access.

## 1. Core model

Arkini has three distinct data forms:

```text
GameConfig
→ validated static game definitions

Runtime
→ hydrated live gameplay snapshot

State
→ serializable gameplay state
```

`Runtime` contains live items, active jobs, and FIFO job requests. A committed runtime value is treated as an immutable snapshot by convention. The store is mutable; committed runtime graphs are not mutated in place.

The engine does not maintain a second read model, React copy, runtime cache, or event-derived reconstruction of gameplay state.

## 2. Canonical committed transition

Every accepted gameplay mutation produces one transition:

```text
CommittedTransition {
  runtime,
  events
}
```

The runtime and its transient events describe the same accepted mutation and commit together.

A mutation that fails validation, is interrupted during planning, or produces neither a changed runtime nor events publishes nothing.

## 3. Runtime write boundary

All production writes enter through `modifyRuntimeFx`.

```text
public command or Tick
→ acquire mutation-planning ownership
→ read latest committed transition
→ run effectful planning against one pinned runtime snapshot
→ validate complete candidate runtime
→ commit accepted transition
```

Nested runtime reads during planning receive the pinned transaction snapshot. A planner may not read a newer runtime halfway through and may not export a detached state-derived plan across the write boundary.

### 3.1 Two synchronization edges

The runtime store deliberately separates two responsibilities.

#### Mutation planning

A semaphore serializes candidate planning. Waiting for ownership and all planning work remain interruptible.

This protects commands from stale-plan races while allowing session disposal to cancel long-running work.

#### Commit and subscription registration

STM owns the tiny canonical linearization edge:

```text
TRef<CommittedTransition>
+
TPubSub<CommittedTransition>
```

Accepted commit is one non-yielding STM transaction:

```text
replace current transition
+
publish the same transition
+
return the command result
```

Current state, publication, and caller-visible success cannot split under interruption.

Listener registration is another STM transaction:

```text
capture current transition
+
subscribe a listener-specific TQueue
```

Therefore a commit has exactly one deterministic relation to registration:

```text
commit before registration
→ captured as current, not replayed

commit after registration
→ delivered once in commit order
```

The acquired queue is owned with `Effect.acquireRelease`, so scope cancellation cannot orphan a subscription.

## 4. Live game bridge boundary

`GameSession` owns the Effect services, Tick, subscriptions, and save lifecycle of one loaded engine. The bridge-level `Game` adds the completed config, embedded resource URLs, and one replacement key. A root-shell `createGameOwner` closure is the only publisher of live `Game` instances; route components request a package but never independently own overlapping sessions. Neither object mirrors runtime state.

The live boundary exposes:

- `getSnapshot()` — synchronous read of the canonical runtime;
- `run(effect)` — execution of documented public engine Effects;
- `subscribe(listener)` — runtime invalidation subscription;
- `subscribeEvents(listener)` — transient event batches for presentation;
- `flushSave()` — explicit persistence flush;
- `dispose()` — coordinated shutdown with a final save;
- `disposeWithoutSave()` — destructive-reset shutdown that stops autosave and waits for in-flight persistence without writing a final snapshot.

`GameSession.run()` remains generic by deliberate soft contract. Bridge domains may run public commands and reads only. UI never imports the engine directly and may not reach runtime-store services through the generic runner.

Replacement follows one serialized ownership transition:

```text
latest requested package
→ await current Game.dispose() and final save
→ create only the latest still-requested package
→ dispose stale bootstrap exactly once
→ publish one ready Game, or one truthful failure state
```

The owner lives above the route outlet so launcher ↔ game navigation and React StrictMode effect replay cannot create a second save owner. It coalesces obsolete intermediate requests but never skips final save/disposal. HMR stores the old owner shutdown Promise in Vite hot data; replacement code waits for that Promise before creating another session. Electron close is also controlled by the same shutdown: the window closes only after final save succeeds, while failure leaves the window open in a truthful retryable state.

Hard reset is the same owner transition with destructive save policy:

```text
current Game.disposeWithoutSave()
→ clear only current packageId + contentHash save
→ create the same package through the normal bootstrap path
→ publish one fresh Game
```

Concurrent hard-reset callers share one Promise and cannot create orphan sessions.

### 4.1 Arkpack and save persistence

Electron `userData` owns two separate opaque repositories:

```text
<userData>/arkini/arkpacks/<sha256>/
  package.arkpack
  descriptor.json

<userData>/arkini/saves/<packageId>/<contentHash>/
  current.arksave
  pending.arksave
```

The original validated Arkpack binary is canonical. Catalog list reads only derived descriptor files; exact read loads one binary and the renderer revalidates its format, identity, config, resources, and SHA-256 before use. Install writes a temporary directory and atomically renames it into place. Package removal never removes saves.

The engine's existing `StateSchema` is the complete canonical save state; creating a separate alias schema would add a second name without a second contract. `fromRuntimeFx` produces a detached state, and session construction hydrates a fresh runtime from validated state. The save codec wraps that state in exactly:

```text
{ namespace: "arkini", format: 1, state }
```

Electron stores the resulting MessagePack bytes opaquely. Writes sync `pending.arksave` and atomically rename it over `current.arksave`; failed replacement preserves the previous successful save. Package identity and content hash select the repository path and are intentionally absent from engine state and the envelope.

Browser-only diagnostics use process-local memory adapters. They are not a second persistent product backend.

## 5. Runtime and event subscriptions

Each external listener owns its own scoped current-plus-tail subscription.

Runtime listeners use the captured current runtime as an identity baseline and are notified only when a later transition changes the runtime root.

Event listeners consume only later event batches. Historical transient events are never replayed to a listener registered after their commit.

Callback delivery is best effort and may lag canonical runtime. Callback throws and rejected Promise-like results are isolated and cannot kill Tick, autosave, or other listeners.

## 6. UI and presentation time

The engine is framework-neutral and authoritative. React is an adapter.

```text
canonical runtime
→ immediate gameplay truth

live bridge projection
→ synchronous view over that exact snapshot, never cached authority

committed transient events
→ facts about accepted mutations

UI animation state
→ intentionally delayed presentation
```

Animations may lag, change direction, collapse, or skip intermediate presentation. Runtime never waits for them.

UI may own:

- local panel, hover, camera, selection, and animation state;
- coordinate-to-pixel or coordinate-to-3D transforms;
- labels, icons, grouping, sorting, and interpolation;
- presentation queues derived from transient events.

UI may not own or reconstruct:

- line start eligibility;
- missing inputs;
- reservation truth;
- queue capacity or FIFO policy;
- effect/rule availability;
- accepted drop behavior;
- job lifecycle state;
- any second runtime snapshot.

## 7. Tick and time

Effect Clock is the only production wall-clock source.

The loaded runtime owns engine-visible ephemeral session state:

```text
runtime.session.speedMode
```

It is canonical for the live session but intentionally absent from serialized gameplay state. Hydration always starts in `normal` mode.

The Tick adapter separately owns transient observation state:

```text
observedAtMs
pendingElapsedMs
```

`pendingElapsedMs` is simulation time, not raw wall time. Neither Tick observation field is persisted.

Simulation uses one canonical 200 ms fixed step.

```text
observe new wall-clock delta
→ scale only that delta by runtime.session.speedMode
→ add simulation milliseconds to pending budget
→ replay all complete fixed steps
→ keep sub-step remainder for the live session
```

Normal mode uses `1×`; accelerated mode uses `30×`. Toggling first folds elapsed wall time under the old mode and only then changes the root runtime session state, so previously observed or pending normal time is never accelerated retroactively. Explicit Tick advancement already supplies simulation milliseconds and never applies the multiplier.

A failed advancement retains its complete pending budget for retry in the same session. A successful advancement consumes each complete step at most once.

Long elapsed intervals are replayed immediately as consecutive fixed steps and must match the equivalent sequence of explicit 200 ms advancements.

One event-free step returning the identical runtime reference proves a stable no-op boundary; the remaining identical backlog may be skipped.

Temporary board items own `remainingDurationMs`, initialized from their authored `durationMs` when the concrete runtime identity is committed. Each identity observed at a step boundary loses exactly one 200 ms step, clamped at zero. An item created by a completion during that step is not in the boundary snapshot and receives no retroactive time.

Ready temporary items expire after job completions in stable runtime-ID order. Expiry removes the item first, then resolves and places its optional output from the released board origin through the canonical deterministic output and placement pipeline. Expected placement failure leaves the same item at `remainingDurationMs: 0` for a later retry; the complete random stream, including random placement origin, is derived from the stable temporary identity. Temporary items are board-only, always identity-bound, and therefore impure.

## 8. Jobs and FIFO requests

Filling inputs is passive. Work starts only through the explicit line-start command.

An owner may have:

- zero or one active job;
- FIFO queued start requests up to its configured capacity.

A queued request is not a job. It owns no time, consumes nothing, and reserves nothing. Pending requests remain editable intent: one explicit owner command may clear the whole pending queue without touching an active job, materials, charges, or outputs.

Immediate and queued starts use the same internal start pipeline. A blocked FIFO head remains first and cannot be overtaken. It waits for fresh runtime facts to make it runnable or for the player to clear that owner's pending queue; the engine never drops it automatically.

Jobs persist only:

```text
durationMs
remainingMs
```

Do not add due times, start timestamps, pause timestamps, persisted Tick cursors, or wall-clock reconstruction metadata.

Inventory is a hard pause for active and ready jobs. Returning the same owner to the board resumes evaluation without a separate resume mutation.

Inventory is passive storage. Commands may move an already stateful owner into inventory, but no command may attach new identity-bound state to an owner while it is stored there.

Started jobs cannot be cancelled. Pending queue requests may be cleared only as the whole current queue of one owner; no command targets a previously observed request shape.

## 9. Inputs and reservations

Material inputs may be consumed or reserved. A material selector names its complete accepted candidate set; every matched item must be eligible to enter input storage. Temporary identities are board-bound and are rejected by both semantic validation and the authoritative store planner.

- both modes commit the accepted quantity only when work actually starts;
- `consume` discards the material's complete passive owned subtree at start, moves the surviving root into consumed `job` scope, and discards that root at completion;
- `reserve` moves the same live instance into `reserved` scope, preserving its identity, runtime state, and passive owned subtree until completion relocates it;
- a zero-capacity material input is closed while its line owns an active job;
- a positive-capacity material input remains open as storage while the line runs.

Input closure is resolved from the same live runtime draft as the delivery command. A queued request does not close an input because it is not an active job. Consumed and reserved items are exclusive job-owned locks and are inaccessible to generic item mutations.

Storing the first input on a stacked owner is a general state-attachment transition. The input transfer is applied inside one candidate first, so a fully consumed source may free board capacity, then the original owner identity is isolated at quantity `1` and the pure remainder follows standard placement. A blocked remainder rolls back the input transfer, split, and every generated event together.

Charge costs are authored on individual inputs. `from: "self"` charges the line owner; `from: "target"` charges the deterministic board item resolved by a deposit input. Resolution reserves charge budget by runtime item ID across the whole line so several inputs cannot independently overbook the same payer. Apply aggregates every cost for one payer and spends it exactly once inside the same candidate runtime.

A fresh charged item keeps no redundant live counter: missing `remainingCharges` means the authored full amount and remains pure. A partial spend stores `remainingCharges`, makes the item stateful, isolates the original board identity at quantity `1`, and standard-places the pure remainder. Fully depleting one idle quantity consumes that quantity in place instead of relocating the rest of its stack. Idle payers that die are resolved before surviving payers that need isolation, allowing one atomic start to use board capacity it frees itself.

A charged item dies when its remaining charges reach zero. An idle external payer is removed immediately during the starting command and emits its optional charge output from its own board origin. A self payer or any payer that already owns an active job may remain temporarily at `remainingCharges: 0`; that active job is the only legal deferred-depletion state.

Completion resolves shared live facts once, removes the ready job and consumed material roots from one immutable draft, keeps reserved instances live, and executes one generic line lifecycle:

```text
discard consumed material roots
→ remove a depleted owner identity and queue
→ resolve optional line.output deterministically
→ resolve optional depleted-owner charges.output deterministically
→ release depleted-owner buffered inputs
→ relocate the same live reserved instances
```

A non-depleted owner remains with its identity, inputs, and queue. A depleted owner is removed before output placement, so ordinary line output receives first access to its freed board origin and depletion output follows. Producer, craft, blueprint, and stash keep separate item schemas, but completion never switches on item type. Item lifetime is controlled only by optional charges and authored input costs.

Starting any stacked line owner resolves eligibility from the pre-command snapshot, then creates the job, applies material plans, and pays all charge plans inside one candidate draft. Charge spending or the active job makes a surviving owner non-pure before isolation, so the pure remainder cannot merge back into it. Public item removal and completion share identity-removal primitives rather than nesting public write commands.

Start and completion are all-or-nothing. Insufficient charges, max-count blockage, depletion-output placement failure, remainder placement failure, or material return blockage publishes no partial runtime or transient events.

Reserved materials retain their runtime identity and state but no original stack, slot, or source position. Completion places each existing instance from the current board position of the line owner. Pure instances may normalize into ordinary stack placement and new identities; impure instances preserve their exact identity and require one exclusive grid cell. Consumed materials return nothing and never trigger charge depletion output merely because they were converted. Never add return-location metadata.

Hydration requires every consumed `job` root to own no remaining input subtree, active work, committed job material, or queued intent. Destructive passive-state cleanup fails rather than cancelling active jobs or deleting committed job material.

## 10. Future output and max-count reservations

An active job reserves the worst-case future quantity of every canonical item its completion may create. This includes its `line.output` and, when its owner has already reached zero charges, the owner's deferred `charges.output`. The calculation is deliberately conservative:

- fixed quantities reserve their value;
- ranges reserve `max`;
- chance rolls reserve the successful outcome;
- repeated weighted rolls reserve the same worst candidate for every selection;
- rolls inside one selected set add together;
- alternative roll sets reserve the per-item maximum.

A queued request owns no reservation. The same authoritative check runs when its FIFO head attempts dispatch; unavailable charges or max-count blockage leaves the request in place until fresh state makes it runnable or the player explicitly clears the owner's pending queue.

Placement, direct spawn, and direct quantity mutation include active-job reservations in their max-count check, so later operations cannot consume capacity already promised to a job. Completion first detaches its ready job from the immutable candidate and then materializes output, which spends that job's reservation without double-counting it. A depleted owner offsets worst-case output of its own canonical item by the live quantity that will disappear.

Immediate depletion output from an idle external payer is created during the start candidate rather than reserved afterward. After all charge spends, the final start max-count assertion validates those live immediate outputs together with every active job reservation, including the candidate job. Any overbooking rejects the complete candidate atomically.

## 11. Deterministic randomness

Line-completion randomness derives from stable job identity and an explicit algorithm version. Deferred depletion output derives from the same job plus the depleted item identity.

Immediate depletion during start derives from stable owner, line, payer, quantity, pre-spend charges, cost, and an explicit algorithm version. An unchanged failed retry therefore resolves the same output and placement order; a successful spend changes the payer state before any later use.

Roll-set selection, chance, weights, quantity ranges, and random placement ordering all use the owned deterministic stream. Tick state and wall-clock time never participate in the seed.

## 12. Purity and placement

Purity is a runtime-derived boolean, not an item-config flag. A line is pure only when it owns no buffered inputs, active job, or queued request. An item is pure only when every line it owns is pure and it owns no additional identity-bound state. Explicit `remainingCharges` is item-owned state; an untouched charged item with no stored counter remains pure at its authored full amount.

Generic stack and quantity mutations may target only pure items. A pure item uses its configured stack size; an impure item has an effective stack size of `1`. Purity is resolved inside the same immutable runtime draft as the mutation and is checked both while planning stack placement and again while applying the plan. Never cache or carry a purity result across a write boundary.

Every operation whose candidate would attach identity-bound state to quantity greater than `1` must preserve the original board identity at quantity `1` and standard-place the pure remainder inside that same candidate. Input storage, line start, and partial charge spending share this isolation rule. Full idle depletion is consumption, not state attachment: it removes one quantity in place. Failure publishes no intermediate state or events. Do not add feature-specific split helpers, and do not invent an inventory placement origin for a stored owner.

Placement is one shared policy used by commands, line output, charge-depletion output, reserved-instance return, and buffered-input release. `placeRuntimeItemFx` is the sole internal entry point for relocating an existing live item; lifecycle callsites must not invent specialized placement branches.

Every board location includes mandatory `space`; one cell is `space + x + y`. Board origins carry that full location through the pipeline. Occupancy, stacking, nearest-first ordering, random origin, charges, merge, and output are local to the origin space. Query reach is explicit: `board` is origin-space board with distance, `inventory` is shared inventory, `any` is origin-space board plus inventory, and `universe` is every board space plus inventory without distance. Scope fallback may continue into the global inventory but never another board space. `runtime.currentSpace` is persistent presentation/navigation state only and never filters Tick, background completion, or explicit off-screen inventory interactions.

Attached ownership state has no independent space while owned. A movable owner transports its complete ownership graph through inventory; destination-local rules are re-evaluated after placement, and all surviving output or reserved state materializes from the owner's current board location rather than any historical origin.

Materialized drops follow this high-level order:

```text
validate max count against live and reserved quantities
→ choose allowed scope policy
→ fill compatible pure stacks
→ spawn into empty locations
→ require full quantity placement
```

Existing-item placement uses the same origin, scope, nearest-first board ordering, and inventory fallback. A pure existing item may normalize through ordinary stack/spawn placement and lose its disposable runtime identity. An impure existing item preserves its exact identity and complete state graph, cannot stack or split, and requires one exclusive empty cell. Buffered release starts only from a board owner position; a loaded owner in passive inventory must return to the board before removal, and inventory coordinates are never reinterpreted as a board origin.

Output board placement is explicitly `drop` or `random`; inventory fallback is derived independently from item scope. Board-first fallback may continue into inventory when the item scope allows it.

Placement failure is a domain failure and rolls back the complete owning mutation. Do not partially place an output, partially spend charges, or partially release reservations.

## 13. Save boundary

Autosave owns persistence, not gameplay truth. Item revisions are runtime-only stale-intent tokens: state omits them, and every hydration creates fresh revisions for the new session. Jobs and queued requests are not revisioned because no command targets their previously observed mutable shape.

```text
current + later committed transitions
→ project runtime
→ deduplicate by runtime root identity
→ debounce
→ serialize writes
```

Event-only transitions neither wake nor postpone autosave.

Flush always reads the latest canonical runtime. Duplicate saves are acceptable. Failed mutations publish nothing and trigger no save.

## 14. Shutdown

Session disposal is coordinated:

```text
reject new commands
→ stop production Tick
→ close session-owned command and listener scopes
→ flush latest stable runtime
→ dispose ManagedRuntime
```

Concurrent callers share the same cleanup Promise. The root game owner awaits that Promise before any replacement bootstrap begins, so two sessions cannot write the same package save namespace concurrently. Confirmed persisted-save nuke uses the separate destructive path:

```text
reject new commands
→ stop production Tick
→ mark autosave discarded
→ wait for any in-flight write
→ close session scopes without final flush
→ delete persisted state
→ create a fresh session
```

The nuke request itself is only a transient presentation event. Cancellation never enters this path, and storage failure propagates without manufacturing a fresh-session success.

A long planner interrupted before commit changes nothing. Once the STM point of no return begins, current state, publication, and success remain coherent.

## 15. Explicit non-decisions

Do not introduce without a concrete reproduced requirement:

- a JavaScript or React runtime mirror;
- a second event bus;
- a central callback registry evaluated at delivery time;
- runtime revision counters for subscription membership;
- a command facade wrapping every public Effect;
- a global command queue;
- recursive deep cloning or freezing of every snapshot;
- persisted Tick cursors or job timestamps;
- job cancellation;
- reverse reconstruction of reservation history;
- gameplay decisions inside UI selectors;
- a generic DTO/read-model hierarchy made only for architectural appearance.
