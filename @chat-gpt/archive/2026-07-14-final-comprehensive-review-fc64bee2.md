# Arkini v1 — final comprehensive review

**Snapshot:** `fc64bee207bf8f89af2d36fbb72f238289ed8dd8`
**Baseline:** same snapshot as the closed STM subscription review
**Scope:** complete `src/v1`, active v1 tests, compiler/validator/pack flow, Tick/jobs/queue, runtime/state/save/session/UI boundaries, and active LLM-facing documentation
**Repository changes:** none
**Review goal:** verify that the codebase remains atomic, standalone-engine friendly, low in redundant synchronization/data hand-offs, understandable to an LLM, and free of changes made merely to manufacture review output.

---

## Executive verdict

The production v1 codebase holds.

I found **no new P1 gameplay/runtime defect**, no split canonical runtime, no mutation path bypassing the committed runtime boundary, no duplicate React-owned gameplay truth, and no current gameplay/domain logic implemented in `src/v1/ui`.

The previously reviewed STM runtime/subscription block remains closed and should not be redesigned again without a concrete new requirement or reproduced bug.

The only major finding is outside the runtime itself:

> **The active project documentation has become a second, contradictory architecture.**

For an ordinary repository this would be documentation debt. For a repository intentionally maintained by an LLM, it is an operational correctness defect: the files explicitly presented as first-read/source-of-truth material contain extensive v0 architecture, removed paths, superseded time/job semantics, and contradictory task status.

Recommended outcome:

1. clean the active documentation surface;
2. fix two stale source comments;
3. optionally remove a tiny dead internal validation chain;
4. otherwise leave the engine architecture alone.

---

## Review result matrix

| Area | Result | Notes |
| --- | --- | --- |
| Runtime mutation atomicity | **Pass** | All production writes use `modifyRuntimeFx`; candidate validation precedes one STM commit. |
| Canonical runtime truth | **Pass** | One `TRef`-owned committed transition; no session or React runtime mirror. |
| Event/runtime consistency | **Pass** | Runtime and transient events are one `CommittedTransition`; failed candidates publish neither. |
| Subscription temporal semantics | **Pass** | Atomic current-plus-tail registration; no pre-registration event replay. |
| Subscription lifetime | **Pass** | Scoped `acquireRelease`; cancellation-safe queue ownership. |
| Autosave isolation | **Pass** | Runtime identity is projected before debounce; event-only commits do not postpone saves. |
| Tick semantics | **Pass** | Failure-safe elapsed budget, 200 ms fixed-step replay, deterministic boundary snapshots. |
| Jobs / FIFO / reservations | **Pass** | One active job per owner, queue-only owners remain processable, reservations are job locks and return via standard placement. |
| Compiler / validator / pack | **Pass** | One canonical completed-config compiler is shared by validation, tests and packing. |
| Core → UI dependency direction | **Pass** | Dependency Cruiser and architecture tests forbid v1 core imports from UI. |
| UI gameplay logic | **Pass** | Current UI files are adapters only; no `canStart`/requirements/job logic is recomputed there. |
| Redundant synchronization | **Pass** | No extra runtime store, listener registry, revision mirror or React copy was found. |
| Orchestrator readability | **Pass** | Main flows are linear, responsibility-aligned and locally understandable. |
| Active documentation truth | **Fail** | Authoritative files materially describe v0 and contradict current v1. |

---

# Findings

## P1 — Active documentation is a split-brain architecture for future LLM work

### Why this is a real v1 correctness problem

The repository says that an LLM is the primary implementer, and several files explicitly instruct the model to read them before source code. Those files therefore participate in the effective development contract.

At present they do not describe one coherent system.

### Evidence

#### Root `README.md` describes removed v0 infrastructure as current

Examples:

- `README.md:12` assigns runtime truth to `RuntimeGameEngineAdapter` / `GameRuntimeStore`.
- `README.md:36-46` names `applyGameActionFx`, `runGameTickFx`, `src/engine`, `src/play/runtime` and `RandomServiceFx` as current boundaries.
- `README.md:52-54` describes the removed `src/tile-engine` and old play/drop topology.
- `README.md:164-166` claims the v1 pack performs no schema validation, while the current pack uses the canonical compiler plus semantic/resource validation.
- `README.md:148` says no lockfile is committed, but `package-lock.json` is present.
- `README.md:12` points to `CONFIG.MD` and `SELECTOR.MD`; neither file exists.
- `README.md:218+` again documents the removed runtime adapter/store boot model.

The active v1 implementation instead uses `RuntimeStoreFx`, STM committed transitions, fixed-step Tick, explicit write commands, `GameSession`, and `RuntimeSaveLayerFx`.

#### `@chat-gpt/README.md` starts current and then falls back into v0

- `@chat-gpt/README.md:3` says “Read this first”.
- `@chat-gpt/README.md:15` correctly documents the current STM/session architecture.
- Starting at `@chat-gpt/README.md:16`, most of the file describes old concepts such as:
  - `RuntimeGameEngineAdapter` / `GameRuntimeStore`;
  - `src/world/*`;
  - `src/action`, `src/engine/model`;
  - old global effects/grants/proximity behavior;
  - board memory, producer/craft save maps and old action/event pipelines;
  - timestamp-oriented delayed jobs and cancellation wording that v1 explicitly rejected.

The file is roughly 31 KB while also stating at `@chat-gpt/README.md:81` that active notes should remain short.

#### Task status contradicts itself

- `@chat-gpt/README.md:7` says the active task queue is closed and cleaned.
- `@chat-gpt/tasks/README.md:3` says an old effect/proximity queue is active.
- Those task files refer heavily to removed `src/effects`, `src/config`, `src/capacity` and v0 runtime types.
- `@chat-gpt/tasks/new-config-feature-gap.md` describes an earlier schema tree and many gaps already implemented in `src/v1`.

A mechanical scan found **44 missing paths out of 45 concrete backticked source/config path references** in active, non-archived `@chat-gpt` notes. Some references are conceptual, but the ratio demonstrates that the active note surface is overwhelmingly archaeological rather than current.

#### `GAME.MD` mixes target gameplay with obsolete implementation facts

`GAME.MD:5` calls itself an LLM-optimized source of truth. It still contains extensive v0-specific implementation contracts, including old wall-clock job timestamps, old effect/grant systems, old runtime views/actions and old UI module paths.

A target gameplay/design document may legitimately describe features not yet implemented. It should not simultaneously prescribe removed implementation topology as current architecture.

### Impact

A future implementation model can reasonably follow these files and:

- recreate a second runtime store or adapter;
- reintroduce wall-clock timestamps into jobs;
- put domain decisions into old-style UI view models;
- resurrect global effects or old save maps;
- create imports toward paths that no longer exist;
- spend substantial context reconciling mutually exclusive “source of truth” documents.

This undermines the exact LLM-friendly property the v1 architecture otherwise achieves.

### Recommended minimal fix

Do not build a documentation framework. Clean the truth surface.

1. **Rewrite root `README.md` around current v1 only.**
   - Current boot/session/runtime model.
   - Current CLI/compiler/validation commands.
   - Current directory topology.
   - Clear statement that `src/v0` is historical/reference-only.

2. **Replace `@chat-gpt/README.md` with a short current index.**
   Keep only durable current rules:
   - one `IdSchema`;
   - standalone engine / thin UI;
   - `*Fx` consistency policy;
   - runtime STM boundary;
   - fixed-step Tick;
   - job/queue/reservation decisions;
   - links to the current dated v1 decision records.

3. **Archive or delete stale active task/backlog files.**
   `tasks/README.md` must agree with the root status. Old effect/proximity/config tasks belong under `archive/` or an explicitly labeled `v0/` area.

4. **Separate gameplay design from implementation state in `GAME.MD`.**
   Either:
   - keep it purely as target game semantics and remove source-path/runtime-topology claims; or
   - split current v1 implementation notes into a separate concise document.

5. **Do not solve this with more cross-linked documents.**
   One short current index plus dated decisions is enough. The problem is too many competing truths, not insufficient prose.

### Acceptance criteria

- A model reading root `README.md`, `GAME.MD` and `@chat-gpt/README.md` receives no mutually exclusive runtime/session/time architecture.
- Active task status is unambiguous.
- Active notes do not cite removed v0 source paths as current.
- `src/v0` is explicitly historical and never the default implementation reference for v1 work.

---

## P3 — Two source comments still teach superseded runtime behavior

These do not affect production behavior, but they are high-value cleanup in an LLM-maintained repository.

### `src/v1/line/fx/run/resolveLineRunFx.ts:31-33`

The comment says the resolver is intended to run inside `SynchronizedRef.modifyEffect`.

Current runtime writes use:

```text
mutation semaphore
→ explicit immutable transaction snapshot
→ candidate validation
→ STM commit
```

The comment should refer to “the serialized runtime mutation planner” or `modifyRuntimeFx`, not the removed synchronization primitive.

### `src/v1/input/schema/InputMaterialSchema.ts:13-15, 33-36`

The schema says a reserved input returns when work completes **or is cancelled**.

Current durable decisions explicitly state:

- started jobs cannot be cancelled;
- do not add job cancellation;
- reservations return on completion through normal drop placement.

Remove cancellation wording until a real cancellation contract is deliberately designed.

### Optional wording alignment

`src/v1/runtime/schema/RuntimeSchema.ts` describes the runtime itself as “mutable”, while the current API contract treats each committed runtime value as an immutable snapshot by convention and only the store is mutable.

A clearer description would be:

> “The canonical gameplay state value composed of live items, active jobs and queued requests.”

This avoids encouraging in-place graph mutation without requiring recursive freeze infrastructure.

---

## P3 — Tiny dead internal validation leftovers

An import-graph scan across `src/v1`, tests and CLI found only two non-public dead chains:

- `src/v1/common/schema/NonEmptyStringListSchema.ts`;
- `src/v1/validation/fx/readOutputItemIdsFx.ts` together with `src/v1/validation/schema/OutputItemIdsSchema.ts`.

They have no inbound imports from production, tests or CLI.

`JobCompletionRandomVersion` in `makeJobCompletionRandomFx.ts` is exported but referenced only inside its own file; it can remain a local constant unless external compatibility tooling is intentionally expected to import it.

This is not architectural debt and not worth a dedicated refactor pass. Remove these while doing the documentation/comment cleanup, or leave them until an adjacent edit. Do not introduce barrels or registries merely to make them appear used.

The three React hooks with no current inbound imports are **not** classified as dead: they are the intended thin public UI adapter surface for the upcoming UI.

---

# Confirmed architecture strengths

## 1. Runtime mutation path is singular and atomic

All ten public write commands plus Tick advancement enter through `modifyRuntimeFx`.

The path is consistently:

```text
public command
→ acquire serialized planning ownership
→ read latest committed transition
→ resolve/plan/apply against one snapshot
→ validate complete candidate runtime
→ STM set current + publish same transition + return result
```

Architecture tests additionally prevent:

- direct `RuntimeStoreFx` use outside the owned internals/layer;
- direct store mutation;
- public write commands without `modifyRuntimeFx`;
- nested write-command calls;
- stale state-derived plans crossing the write boundary;
- missing revision guards on commands that mutate caller-selected live entities.

This is the correct shape. Do not wrap it in another command bus or repository abstraction.

## 2. Engine/session/UI hold one runtime truth

`createGameSession` owns no local runtime mirror.

- `getSnapshot()` reads the canonical runtime synchronously.
- Runtime and event subscribers receive listener-specific current-plus-tail subscriptions.
- React uses `useSyncExternalStore` over that canonical snapshot.
- Autosave reads/projections derive from the same committed runtime.
- UI may retain presentation state but currently contains no gameplay computation.

The accepted soft contracts remain sensible for this game:

- consumers do not mutate snapshot objects;
- UI does not abuse generic `GameSession.run()` to access internal store capabilities;
- violations are review failures rather than reasons to build a deep-freeze/facade onion.

## 3. Tick/job/queue model is coherent

The time path is understandable end-to-end:

```text
Effect Clock observation
→ failure-safe pending elapsed budget
→ whole 200 ms step budget
→ one locked runtime replay
→ fixed shared boundary snapshot per step
→ runnable work decrement
→ completion / reservation release / output placement
→ FIFO successor dispatch
→ atomic runtime + event commit
```

Important properties remain present:

- elapsed budget is consumed at most once;
- failed runtime application retains the budget;
- same job completion identity reproduces deterministic random choices on retry;
- inventory is a hard pause rather than a fake board coordinate;
- queue-only owners remain in the workset;
- blocked FIFO heads are not overtaken;
- reservation resources are inaccessible to generic mutations and return via standard placement;
- stable no-op backlog is skipped safely.

Current authored line durations top out around 150 seconds, so literal fixed-step replay remains bounded to hundreds of changing steps for current content before reaching a stable no-op. No new scheduler/fast-forward abstraction is justified now.

## 4. Compiler and validator own one completed-config boundary

The authoring path is singular:

```text
collect/read source fragments
→ deterministic assembly with provenance
→ completed `GameConfigSchema` parse
→ semantic validation
→ resource validation
→ assert valid
→ pack
```

Tests and CLI reuse the same compiler. The earlier possibility of tests/packer validating different realities is gone.

## 5. Orchestrators are readable and SRP remains useful rather than ceremonial

The largest TypeScript source file in `src/v1` is 190 lines. The main orchestrators are generally 90–150 lines and read in domain order.

Representative good boundaries:

- `storeInputMaterialFx`: resolve entities → assert source revision/location → resolve slot → plan → apply.
- `resolveLineRunFx`: owner/line → rules → visibility/enable/runtime → inputs → plan.
- `advanceRuntimeStepFx`: queue-only dispatch → freeze step facts → decrement → complete → dispatch successors.
- `completeJobRuntimeFx`: resolve live job/owner/line → remove job reservations → place reservations → resolve/place output.
- `createGameSession`: build layers/runtime/scope → expose canonical read/run/subscriptions → coordinated disposal.

The small domain `*Fx` helpers are not a problem. They form the intentionally consistent grammar requested for LLM implementation. Do not inline them merely because they have one callsite.

## 6. Duplication is low and mostly intentional

A duplication scan found approximately 0.58% duplicated lines. The reported clones are chiefly expected command/schema/consume-reserve patterns.

Given the deliberate consistency policy, consolidating those patterns would likely increase generic abstraction and reduce local readability. Leave them alone unless behavior begins to diverge.

---

# Mental-load assessment for future LLM work

## Strong areas

A future model can answer the key questions locally:

- **Where is canonical gameplay truth?** `RuntimeStoreFx` current transition.
- **How may it change?** Public command → `modifyRuntimeFx`.
- **When is a change committed?** One STM transaction after candidate validation.
- **How does time enter?** `TickFx` from Effect Clock, replayed in fixed steps.
- **Who owns delayed work?** Active jobs plus FIFO requests in runtime.
- **What does UI own?** React adaptation and presentation only.
- **How is game config trusted?** Canonical compiler plus semantic/resource validators.

The source layout is domain-first and grep-friendly. There are no import cycles, no barrels hiding ownership and no oversized god module.

## Current highest mental-load area

The highest mental load is no longer source code. It is deciding which documentation is truthful.

Once the active documentation is cleaned, the remaining difficult source areas are reasonable domain complexity rather than accidental architecture:

- fixed-step cross-owner job progression;
- exact input consume/reserve plans;
- placement with replace/stack/scope fallbacks;
- semantic config validation graphs.

These areas already have named phases and focused tests. They should not be restructured merely to shorten individual files.

---

# Explicit non-findings / do-not-do list

The final review did **not** find a reason to:

- replace STM or the runtime semaphore;
- add a second event bus;
- introduce runtime revision counters for subscriptions;
- deep-clone or recursively freeze every snapshot;
- replace `GameSession.run()` with a large command façade;
- add React-owned gameplay projections/state mirrors;
- move gameplay booleans into UI;
- convert pure-looking helpers away from `Fx` contrary to the repository convention;
- inline the small `when`, selector, query or rule functions;
- consolidate every repeated command/schema pattern;
- add a generalized Tick scheduler or optimized event-boundary simulator;
- add reverse reservation reconstruction to persisted jobs;
- add job cancellation;
- redesign placement, queue or reservation ownership again.

Those would currently be architecture work without a reproduced problem, which is just vandalism wearing a lanyard.

---

# Suggested closeout order

One small maintenance slice is enough:

1. Rewrite/trim active root and `@chat-gpt` documentation to one current v1 truth.
2. Archive stale task/backlog documents and make queue status unambiguous.
3. Separate target gameplay prose from obsolete implementation claims in `GAME.MD`.
4. Fix the two stale source comments.
5. Optionally delete the tiny dead internal validation files/localize the random version constant.
6. Run the normal check gate.
7. Close the comprehensive architecture review.

No production engine refactor is recommended.

---

# Verification

```text
HEAD: fc64bee207bf8f89af2d36fbb72f238289ed8dd8
git status: clean
git diff --check: passed

src/v1: 474 files / 17,639 TypeScript lines
largest source file: 190 lines
import cycles: 0
dependency violations: 0
format: passed
source typecheck: passed
test typecheck: passed
game:validate game/arkini: passed
tests: 124 files / 330 tests passed
jscpd: ~0.58% duplicated lines
commits during review: none
```

---

# Final decision

**Runtime/code architecture: approved.**
**STM atomic boundary block: remains closed.**
**Whole-v1 comprehensive review: code-complete, pending documentation truth cleanup only.**

After the documentation/comments cleanup, the correct action is to continue feature work rather than perform another general architecture refactor.
