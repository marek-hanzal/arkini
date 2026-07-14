# Arkini architecture

This document is the canonical technical architecture. It describes the implemented engine, not an aspirational rewrite.

All source paths are relative to the active source root.

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

## 4. Public session boundary

`GameSession` is the browser-facing owner of one loaded game.

It exposes:

- `getSnapshot()` — synchronous read of the canonical runtime;
- `run(effect)` — execution of documented public engine Effects;
- `subscribe(listener)` — runtime invalidation subscription;
- `subscribeEvents(listener)` — transient event batches for presentation;
- `flushSave()` — explicit persistence flush;
- `dispose()` — coordinated shutdown.

`GameSession.run()` remains generic by deliberate soft contract. UI and normal consumers may run public commands and reads only. They may not reach internal runtime-store services through the generic runner.

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

The Tick adapter owns transient session timing:

```text
observedAtMs
pendingElapsedMs
```

These values are not gameplay state and are not persisted.

Simulation uses one canonical 200 ms fixed step.

```text
observe elapsed time
→ add to pending budget
→ replay all complete fixed steps
→ keep sub-step remainder for the live session
```

A failed advancement retains its complete pending budget for retry in the same session. A successful advancement consumes each complete step at most once.

Long elapsed intervals are replayed immediately as consecutive fixed steps and must match the equivalent sequence of explicit 200 ms advancements.

One event-free step returning the identical runtime reference proves a stable no-op boundary; the remaining identical backlog may be skipped.

## 8. Jobs and FIFO requests

Filling inputs is passive. Work starts only through the explicit line-start command.

An owner may have:

- zero or one active job;
- FIFO queued start requests up to its configured capacity.

A queued request is not a job. It owns no time, consumes nothing, and reserves nothing.

Immediate and queued starts use the same internal start pipeline. A blocked FIFO head remains first and cannot be overtaken.

Jobs persist only:

```text
durationMs
remainingMs
```

Do not add due times, start timestamps, pause timestamps, persisted Tick cursors, or wall-clock reconstruction metadata.

Inventory is a hard pause for active and ready jobs. Returning the same owner to the board resumes evaluation without a separate resume mutation.

Inventory is passive storage. Commands may move an already stateful owner into inventory, but no command may attach new identity-bound state to an owner while it is stored there.

Started jobs cannot be cancelled.

## 9. Inputs and reservations

Material inputs may be consumed or reserved.

- `consume` removes the accepted quantity when work starts.
- `reserve` moves accepted material representations into job scope.
- a zero-capacity material input is closed while its line owns an active job;
- a positive-capacity material input remains open as storage while the line runs.

Input closure is resolved from the same live runtime draft as the delivery command. A queued request does not close an input because it is not an active job. Job-scoped items are exclusive locks and are inaccessible to generic item mutations.

Storing the first input on a stacked owner is a general state-attachment transition. The input transfer is applied inside one candidate first, so a fully consumed source may free board capacity, then the original owner identity is isolated at quantity `1` and the pure remainder follows standard placement. A blocked remainder rolls back the input transfer, split, and every generated event together.

Completion resolves shared live facts once, removes the ready job and detached reservations from one immutable draft, and executes one line lifecycle driven by authored data:

```text
resolve optional line.output deterministically
→ preserve every authored drop placement
→ apply item.afterCompletion keep/remove
→ release removed-owner buffered inputs
→ return job reservations
```

Producer, craft, blueprint, and stash keep their separate item schemas, but completion never switches on item type. Every line-owning item declares `afterCompletion: "keep" | "remove"`; any line may omit output, and output always lives on `line.output`. A `keep` owner retains its identity, buffered inputs, and queue. A `remove` owner loses its identity and queue, output claims capacity before buffered inputs and reservations return, and a non-replacement completion frees the owner cell before ordinary output placement. Authored `replace` is valid only for a removing owner and removes the old identity through the standard placement plan.

Starting any stacked line owner first resolves eligibility from the pre-command snapshot, then creates the job and applies its input plan inside the candidate draft, isolates the original owner at quantity `1`, and routes the pure remainder through standard placement. The job makes the owner non-pure before placement, so the remainder cannot merge back into it. Public item removal and completion share the same identity-removal primitive rather than nesting public write commands.

Completion is all-or-nothing. Placement or return blocking leaves the ready job, owner, queue, buffered inputs, and reservations unchanged for a later fixed-step retry.

Reservations retain no original runtime instance, stack, slot, or source position. Never add return-location metadata or reverse reservation reconstruction.

## 10. Future output and max-count reservations

An active job reserves the worst-case future quantity of every canonical item its line output may create. The calculation is deliberately conservative:

- fixed quantities reserve their value;
- ranges reserve `max`;
- chance rolls reserve the successful outcome;
- repeated weighted rolls reserve the same worst candidate for every selection;
- rolls inside one selected set add together;
- alternative roll sets reserve the per-item maximum;

A queued request owns no reservation. The same authoritative check runs when its FIFO head attempts dispatch; max-count blockage leaves the request in place.

Placement, direct spawn, and direct quantity replacement include active-job reservations in their max-count check, so later operations cannot consume capacity already promised to a job. Completion first detaches its ready job from the immutable candidate and then materializes output, which spends that job's reservation without double-counting it. For a removing owner, reservation planning subtracts the live owner quantity from worst-case output of the same canonical item, because replacement is a net change rather than a second copy.

## 11. Deterministic completion randomness

Job completion randomness is derived from stable job identity and an explicit algorithm version.

The same random stream owns roll-set selection, chance, weights, quantity ranges, and random placement ordering for that completion.

A blocked completion, restored state, or retry therefore produces the same random outcome for the same job.

Tick state and wall-clock time do not participate in the seed.

## 12. Purity and placement

Purity is a runtime-derived boolean, not an item-config flag. A line is pure only when it owns no buffered inputs, active job, or queued request. An item is pure only when every line it owns is pure and it owns no additional identity-bound state. Future temporary lifetime, deposit capacity, charges, memory, or similar state must extend the item purity boundary.

Generic stack and quantity mutations may target only pure items. A pure item uses its configured stack size; an impure item has an effective stack size of `1`. Purity is resolved inside the same immutable runtime draft as the mutation and is checked both while planning stack placement and again while applying the plan. Never cache or carry a purity result across a write boundary.

Every operation whose candidate would attach identity-bound state to quantity greater than `1` must preserve the original board identity at quantity `1` and standard-place the pure remainder inside that same candidate. Input storage and generic line start use one shared isolation primitive. Failure publishes no intermediate state or events. Do not add feature-specific split helpers, and do not invent an inventory placement origin for a stored owner.

Placement is one shared policy used by commands, job output, reservation return, and owner-input release.

The high-level order is:

```text
validate max count and replacement contract
→ apply explicit replacement prefix when present
→ choose allowed scope policy
→ fill compatible pure stacks
→ spawn into empty locations
→ require full quantity placement
```

Board-first fallback may continue into inventory when the item scope allows it.

Placement failure is a domain failure and rolls back the complete owning mutation. Do not partially place an output or partially release reservations.

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

Concurrent callers share the same cleanup Promise.

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
