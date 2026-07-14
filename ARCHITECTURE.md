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

Started jobs cannot be cancelled.

## 9. Inputs and reservations

Material inputs may be consumed or reserved.

- `consume` removes the accepted quantity when work starts.
- `reserve` moves accepted material representations into job scope.

Job-scoped items are exclusive locks and are inaccessible to generic item mutations.

Completion resolves shared live facts once, removes the ready job and detached reservations from one immutable draft, and dispatches an explicit owner-specific branch:

```text
producer completion
craft completion
blueprint completion
stash completion
```

The branches share deterministic RNG, placement primitives, and the same validated Tick mutation, but each branch owns its lifecycle order. Producers remain persistent. Starting a stacked craft atomically isolates one owner quantity and routes the remainder through standard placement before the job exists. Craft completion therefore owns exactly one quantity, applies an optional resolved replacement at the original cell, places additional output, and then releases reservations. Blueprint and stash branches remain explicit extension points for their dedicated lifecycle tasks rather than growing conditionals inside producer completion.

Completion is all-or-nothing. Capacity or max-count blocking leaves the ready job, owner quantity, and reservations unchanged for a later fixed-step retry.

Reservations retain no original runtime instance, stack, slot, or source position. Never add return-location metadata or reverse reservation reconstruction.

## 10. Deterministic completion randomness

Job completion randomness is derived from stable job identity and an explicit algorithm version.

The same random stream owns roll-set selection, chance, weights, quantity ranges, and random placement ordering for that completion.

A blocked completion, restored state, or retry therefore produces the same random outcome for the same job.

Tick state, wall-clock time, and job revision do not participate in the seed.

## 11. Placement

Placement is one shared policy used by commands, job output, reservation return, and owner-input release.

The high-level order is:

```text
validate max count and replacement contract
→ apply explicit replacement prefix when present
→ choose allowed scope policy
→ fill compatible stacks
→ spawn into empty locations
→ require full quantity placement
```

Board-first fallback may continue into inventory when the item scope allows it.

Placement failure is a domain failure and rolls back the complete owning mutation. Do not partially place an output or partially release reservations.

## 12. Save boundary

Autosave owns persistence, not gameplay truth.

```text
current + later committed transitions
→ project runtime
→ deduplicate by runtime root identity
→ debounce
→ serialize writes
```

Event-only transitions neither wake nor postpone autosave.

Flush always reads the latest canonical runtime. Duplicate saves are acceptable. Failed mutations publish nothing and trigger no save.

## 13. Shutdown

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

## 14. Explicit non-decisions

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
