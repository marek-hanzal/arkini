# Arkini v1 STM atomic-boundary follow-up review

- Reviewed snapshot: `757e96e8459757c37d702b8b361d6e1b5662ddbd`
- Baseline: `f244105b1805c876e58820156f42db7ec5041c97`
- Commits reviewed:
  - `0e8b49a3 Harden v1 transition store with STM`
  - `757e96e8 Close v1 STM boundary review`
- Review scope: closure of the previous atomic-boundary findings plus a fresh pass over runtime mutation atomicity, subscription temporal semantics, cancellation, session/save/UI boundaries, redundant synchronization/data passing, and LLM mental load
- Repository changes made by review: none

## Executive verdict

The root rewrite is correct and materially better than the semaphore-only version.

The two previous findings are closed:

1. synchronous React/event subscription no longer waits on long mutation planning;
2. accepted current replacement, publication, and caller result now share one non-yielding STM point of no return.

The final topology is coherent:

```text
interruptible mutation-planning semaphore
→ read canonical transition
→ build and validate candidate
→ one STM commit:
     replace current TRef
     publish same transition to TPubSub
     return command result

independent subscription registration
→ one STM commit:
     capture current TRef
     subscribe TQueue to TPubSub
```

No mirror, revision counter, callback registry, second event bus, readiness latch, or React-owned truth was introduced. This is the correct root-level fix rather than another synchronization bandage.

I found no new gameplay or session P1 regression. The implementation survived targeted race probes beyond the permanent test suite.

One narrow lifecycle issue remains:

- **P2 — subscription queue acquisition and scope-finalizer registration are still two separate Effect steps.** An interruption in that tiny gap can leave an orphaned TPubSub subscription retaining later transitions until the store dies. The normal React `runSync` path is not exposed to that interruption, but `CommittedTransitionsFx.subscribe` is a general scoped engine service and should own its resource cancellation-safely.

There is also one small permanent test gap:

- **P3 — the store tests do not yet prove that the mutation semaphore remains usable after an interrupted or failed planner.** Destructive review probes passed; this should become a permanent regression test because the semaphore is the canonical write gate.

After the scoped-acquisition hardening, I would consider the atomic transition boundary done.

---

# Commit review

## `0e8b49a3 Harden v1 transition store with STM`

### Approved architecture

The commit separates two temporal contracts that the previous implementation incorrectly forced through one semaphore:

```text
long/effectful command planning
versus
small synchronous commit/subscription linearization
```

That is the important architectural correction.

Confirmed properties:

- waiting for mutation ownership remains interruptible;
- candidate planning and validation remain interruptible;
- mutation plans are still serialized against the latest committed runtime;
- subscriptions never touch the planning semaphore;
- `read` is synchronously runnable from the canonical `TRef`;
- current capture plus queue creation are one STM transaction;
- current replacement plus publication are one STM transaction;
- the command result cannot report interruption after publication has become observable;
- event-only transitions preserve runtime identity;
- no-op transitions still publish nothing;
- listener-specific queues receive the same transition reference rather than copied runtime graphs.

The manual `Effect.uninterruptibleMask` is justified here. It establishes an explicit point of no return without making the expensive planner or Tick replay uninterruptible.

### Code quality

`makeRuntimeStoreFx` remains compact and locally understandable. It now owns two explicit synchronization edges instead of one deceptively universal mutex.

The comments at the two important boundaries are useful and truthful:

- lines 29-30 explain that ownership waiting and planning remain cancellable;
- lines 46-47 identify the point of no return;
- lines 63-64 explain why registration bypasses the planning semaphore.

Do not split this file into multiple single-purpose files. The current locality is an advantage because a reader can see the complete temporal model in one place.

## `757e96e8 Close v1 STM boundary review`

Approved.

The canonical documentation now matches the implementation:

- `TRef + TPubSub` own committed truth and publication;
- the semaphore owns planning only;
- STM owns commit and registration linearization;
- React has no runtime mirror;
- autosave consumes runtime identity rather than transient events;
- generic `GameSession.run()` and snapshot immutability remain deliberate review-enforced soft contracts.

The resolved prior report is correctly archived and points to the active managed-session contract.

---

# Previous review closure matrix

| Previous finding | Status | Evidence |
|---|---|---|
| `subscribe()` throws `AsyncFiberException` while a mutation owns the semaphore | **Closed** | Registration uses STM only and does not touch `mutationSemaphore`; runtime and event contention tests pass. |
| Commit/current/publication/caller result can split under interruption | **Closed** | Accepted tail runs under the outer uninterruptible mask as one synchronous STM commit. Publication-observed interrupt stress always returned success. |
| Late subscriber receives an already committed event | **Still closed** | Current capture and TPubSub subscription are one STM transaction. |
| Runtime subscriber receives stale invalidation | **Still closed** | Captured current is baseline only; tail contains later commits. |
| Event-only traffic postpones autosave | **Still closed** | Runtime is projected and deduplicated before debounce. |
| Session holds a second runtime truth | **Still closed** | `getSnapshot()` reads canonical `RuntimeFx` synchronously. |
| UI owns gameplay decisions | **Still closed** | Current `src/v1/ui` contains adapters/projections only. |

---

# Finding

## P2 — scoped subscription acquisition has a cancellation gap

### Location

`src/v1/runtime/internal/makeRuntimeStoreFx.ts:62-84`

### Current flow

```text
STM commit:
  capture current
  create TPubSub subscription queue

create shutdown Effect

Effect.addFinalizer(queue.shutdown)
```

The TPubSub subscription becomes live at the first STM commit. Scope ownership is registered only at the later `Effect.addFinalizer` step.

### Failure window

If the subscribing fiber is interrupted after the STM acquisition commits but before the finalizer is registered:

```text
subscriber count increased
+ queue attached to TPubSub
→ interruption
→ scope never learns queue.shutdown
```

The orphaned unbounded subscription can retain every later committed transition until the whole runtime store becomes unreachable.

### Current practical exposure

The browser `session.subscribe()` and `subscribeEvents()` paths use `ManagedRuntime.runSync`, so they do not normally yield inside this short sequence.

However:

- `CommittedTransitionsFx.subscribe` is exposed as a general scoped engine service;
- autosave acquires it from scoped Effect code;
- future standalone consumers may acquire it asynchronously;
- the service contract itself promises scoped ownership and should be cancellation-safe independently of current callsite behavior.

This is not a reason to introduce another synchronization layer. It is a standard resource-acquisition boundary.

### Recommended root fix

Register release with acquisition using `Effect.acquireRelease`:

```text
acquire uninterruptibly:
  one STM current + TQueue subscription
register queue.shutdown as release
return captured current + stream + explicit idempotent shutdown
```

Conceptual shape:

```ts
const subscription = yield* Effect.acquireRelease(
  STM.commit(
    STM.gen(function* () {
      const captured = yield* TRef.get(current);
      const queue = yield* TPubSub.subscribe(changes);
      return { captured, queue };
    }),
  ),
  ({ queue }) => STM.commit(queue.shutdown),
);
```

This preserves all desired properties:

- synchronous `runSync` registration;
- one STM linearization point;
- explicit manual shutdown;
- idempotent scope cleanup;
- no new store, counter, cache, registry, or façade.

It also removes the manual `Effect.addFinalizer` sequence, so the fix reduces rather than increases mental load.

### Acceptance tests

A deterministic cancellation test may require a small test-only seam around acquisition/finalizer registration. Do not expose subscriber counts through production API merely for the test.

At minimum preserve the existing matrix:

- registration while a planner is blocked remains synchronous;
- before/after commit semantics remain exact;
- explicit shutdown prevents later delivery;
- scope close shuts every remaining queue.

---

# Test coverage follow-up

## P3 — prove semaphore recovery after interrupted and failed planning

The permanent store tests verify:

- interrupted planning changes/publishes nothing;
- publication-observed commit returns success.

They do not run another mutation after interruption or planner failure.

A review probe confirmed the implementation is currently correct:

```text
blocked planner interrupted
→ next mutation commits

planner fails normally
→ next mutation commits
```

Add one focused regression test to `test/runtime/internal/makeRuntimeStoreFx.test.ts` so a future edit cannot accidentally retain the planning permit while still satisfying the existing assertions.

This is a test hardening item, not a current production bug.

---

# Atomicity and synchronization audit

## Internal engine truth

Approved:

- one canonical `CommittedTransition` root;
- one mutation planning gate;
- one accepted commit point;
- runtime and transient events remain one transition envelope;
- candidate validation happens before commit;
- failed/interrupted planning publishes nothing;
- current replacement and publication cannot diverge;
- nested `RuntimeFx` reads stay pinned to the transaction snapshot;
- command completion cannot lag canonical current.

No split internal truth was found.

## Engine to external world

Approved:

- `GameSession.getSnapshot()` reads canonical runtime directly;
- command completion precedes synchronous visibility of the committed snapshot;
- runtime/event listeners consume later canonical transitions;
- late subscribers do not replay old transient events;
- callback delivery may lag canonical runtime intentionally;
- React holds no runtime mirror or gameplay state reconstruction;
- autosave reads the latest canonical runtime and ignores event-only timing.

No new external split-brain path was found in the reviewed changes.

## Redundant synchronization and data passing

The current mechanisms each own a distinct responsibility:

```text
mutationSemaphore
→ serialize effectful candidate planning

STM TRef
→ canonical committed transition

STM TPubSub
→ ordered transition publication

listener TQueue
→ listener-specific temporal membership and delivery

save semaphore
→ serialize external persistence writes
```

None of these is a duplicate source of gameplay truth.

Each listener receives a reference to the same committed transition. Runtime graphs are not cloned or copied per listener. Listener-specific queues add scheduling overhead, but they are the reason subscription membership is fixed at registration rather than guessed later at callback-delivery time.

Do not re-centralize listeners or introduce a revision cache to reduce queue count without profiling evidence.

---

# UI boundary review

Current `src/v1/ui` remains clean:

- no line readiness computation;
- no input/reservation/queue policy reconstruction;
- no drop acceptance logic;
- no job state transition logic;
- no local runtime mirror;
- no direct core-internal imports;
- no core-to-UI imports.

`useRuntimeSelector` is still a generic presentation projection adapter. Under the accepted project policy this remains review-enforced rather than wrapped in a large read-model API made only for ceremony.

No engine logic leaked into UI in this snapshot.

---

# LLM mental-load review

## Improvement

The final store model is easier to reason about than the previous semaphore-only design:

```text
planning lock
≠
commit/subscription linearization
```

As an LLM, I can answer the important questions without traversing unrelated files:

- where is the canonical truth? `TRef current`;
- what serializes commands? `mutationSemaphore`;
- when does cancellation stop being allowed? accepted STM tail;
- how are events tied to runtime? same `CommittedTransition`;
- what determines subscriber membership? current capture + TPubSub subscribe transaction;
- why can React subscribe synchronously? registration never waits on planning.

STM is a specialized primitive, but it is contained in one internal factory and documented in the canonical architecture note. That is a good tradeoff.

## Remaining hotspot

`makeRuntimeStoreFx` is now the one file where Effect interruption and STM semantics meet. It should remain deliberately boring and heavily protected by tests.

Do not:

- abstract the STM transaction behind generic helper factories;
- split read/commit/subscribe into separate modules;
- generalize it into an application-wide transactional framework;
- mix other gameplay state into STM;
- move mutation planning itself into STM.

The narrow use is what keeps the mental load acceptable.

---

# Destructive probes performed by this review

Temporary probe files were removed after execution.

## Commit/subscription race

300 iterations raced an immediate mutation against subscription registration.

Every iteration produced exactly one valid outcome:

```text
subscription current === next transition
→ queue contains nothing
```

or:

```text
subscription current === previous transition
→ queue contains next transition exactly once
```

No gap, duplicate, or mismatched transition was observed.

## Interrupt after observable publication

300 iterations:

```text
start mutation
→ wait until subscriber observes next transition
→ interrupt mutation fiber
```

Every mutation exited successfully with its expected result, and canonical current was the published transition.

## Planning semaphore recovery

Confirmed:

```text
interrupt blocked planner
→ subsequent mutation succeeds

fail planner
→ subsequent mutation succeeds
```

---

# Recommended implementation order

1. Wrap subscription acquisition and queue release in `Effect.acquireRelease`.
2. Add permanent semaphore-recovery regression coverage.
3. Re-run the existing boundary matrix and full checks.
4. Mark the STM atomic-boundary review fully closed.

No broader redesign is recommended.

---

# Do not do

- Do not restore the old shared semaphore for subscriptions.
- Do not add a React runtime mirror.
- Do not introduce revision counters or registration markers.
- Do not add another event bus or callback registry.
- Do not make planning/Tick replay uninterruptible.
- Do not deep-freeze or recursively clone runtime graphs as part of this fix.
- Do not build a command façade onion around `GameSession.run()`.
- Do not centralize listener delivery merely to reduce queue count.
- Do not split the store into micro-helper files.

---

# Definition of done

The atomic transition boundary can be considered complete when:

- planning remains interruptible and serialized;
- accepted commit, publication, and caller result stay coherent;
- synchronous subscriptions never wait on planning;
- registration is exactly before or after a commit;
- subscription acquisition cannot leak a queue under cancellation;
- interrupted/failed planners demonstrably release mutation ownership;
- canonical runtime remains the only engine/UI truth;
- event-only traffic remains isolated from runtime subscribers and autosave;
- UI continues to own presentation only;
- no extra synchronization source or data mirror is introduced.

---

# Verification

```text
HEAD: 757e96e8459757c37d702b8b361d6e1b5662ddbd
baseline: f244105b1805c876e58820156f42db7ec5041c97
git status: clean

git diff --check: passed
format: passed (1979 files)
dependency graph: passed (486 modules / 1982 dependencies)
source typecheck: passed
test typecheck: passed
game:validate game/arkini: passed
tests: 124 files / 328 tests passed with maxWorkers=1 and maxWorkers=2
repository commits made by review: none
```

The unconstrained Vitest run attempted to use the environment's reported 56 CPUs and exceeded the execution timeout. The same complete suite passed in approximately 32 seconds with one and two workers. This is treated as review-environment worker oversubscription, not as evidence of an engine deadlock.
