# Arkini v1 — Runtime Purity / Closed Inputs Deep Review

Date: 2026-07-14
Reviewed HEAD: `e3991d3313b56f49a1f3fa406ebb2bc2244f7de0`
Baseline: `91b28370d2f905665b53fa3df11d77a028c83c4a`
Review mode: independent, no repository changes or commits

## Executive verdict

The new purity model is directionally correct and its implementation is locally clean:

- purity is a derived query rather than stored state;
- line input, active job, and queue ownership compose into item purity;
- generic placement no longer stacks into an impure target;
- stale placement plans re-check purity during apply;
- zero-capacity active line inputs are closed consistently in command and runtime validation;
- craft authoring enforces material `capacity: 0` at schema level without contaminating the generic line model;
- the old `excludedStackItemIds` placement parameter was removed.

The slice is nevertheless **not complete**. It implements the read side of the purity contract, but not the write-side invariant:

> Any operation that attaches identity-bound runtime state to a pure stack must first atomically isolate exactly one instance.

Today input storage and generic line start can attach state to an entire stack record. The resulting impure stack is accepted by the runtime checker. This violates the agreed domain model and breaks the promised atomic interaction semantics.

This should be fixed as one general state-attachment invariant, not as separate producer/craft/stash exceptions.

---

## Change overview

Commits since baseline:

```text
aaca00ec Enforce item purity and closed inputs
e3991d33 Close craft purity review
```

The implementation slice is focused. No unrelated feature work or UI changes were mixed in.

Main additions:

- canonical `isItemPureFx` / `isLinePureFx` query chain;
- pure-only stack target selection and apply-time revalidation;
- pure-only direct quantity mutation;
- active zero-capacity input closure;
- craft-specific material input schema with literal zero capacity;
- craft start split after creating the job candidate;
- runtime issues for closed input and non-isolated active craft owner.

---

# Confirmed strengths

## 1. Purity is modeled as a reversible query

`isItemPureFx` does not introduce another persisted boolean or synchronized cache. It derives purity from the current runtime:

```text
item
→ owned lines
→ buffered input / active job / queued request
→ pure only when all owned runtime state is absent
```

That matches the domain decision:

- an empty producer may be pure;
- storing input makes it impure;
- after all attached state disappears, it may become pure again;
- two impure items are never interchangeable merely because their state happens to be deeply equal.

The small `*Fx` decomposition is useful here. Each helper names one state-owning dimension and preserves the established LLM-friendly grammar. Do not inline these helpers merely to reduce file count.

## 2. Placement checks purity twice

`readAvailableStackItemsFx` filters impure targets during planning, while `applyPlacementPlanFx` checks the selected target again during application.

This is the correct optimistic-plan / authoritative-apply shape:

```text
preview or earlier plan
→ candidate target looked pure

fresh apply
→ target became impure
→ reject instead of stacking stale intent
```

This closes the earlier active-owner re-stack bug without carrying feature-specific exclusion IDs through the placement stack.

## 3. Job-before-split ordering is a good idea

For craft start, the implementation first adds the active job to the candidate runtime and only then sends the remainder through standard placement.

That makes the surviving owner impure before placement planning, so the remainder naturally cannot stack back into it. This is cleaner than a special placement exception and should be retained in the generalized solution.

## 4. Closed-line policy has one clear owner

`isLineInputClosedFx` expresses the policy:

```text
capacity === 0
+ active job for the owner and line
→ input closed
```

It is reused by both:

- `storeInputMaterialFx`, which returns `LineInputClosedError`;
- runtime validation, which reports `line:input-closed`.

Positive-capacity producer lines remain open while running, which matches the intended buffering semantics.

## 5. Craft schema narrowing is proportionate

The new schema structure is justified:

- `CraftInputMaterialSchema` uses `capacity: z.literal(0).default(0)`;
- `CraftInputSchema` preserves the existing input variants;
- `CraftLineSchema` narrows only the craft line input tuple;
- the shared generic `LineSchema` is not polluted with craft conditionals.

This is not unnecessary schema complexity. It makes the authoring contract explicit and allows downstream types to know that authored craft material capacity cannot be positive.

Do not replace this with a late semantic refinement or silent compiler normalization. The schema is the correct boundary.

---

# P1 — State can be attached to an entire stack

## Root problem

The engine now knows how to ask whether an item is pure, but it does not enforce the converse invariant:

```text
operation attaches item-specific runtime state
+ target quantity > 1
→ isolate one instance first, atomically
```

`storeInputMaterialFx` currently applies the input store plan directly to the original owner runtime. It never isolates a stacked owner.

`startLineRuntimeFx` isolates only craft owners through `splitCraftOwnerForStartFx`; a stackable producer or other line owner can receive an active job as a quantity greater than one.

The runtime checker only detects the craft-specific active-job case. It does not reject a generic impure stack.

## Reproduction A — buffered input on a stacked producer

Initial state:

```text
producer runtime item: quantity 2, pure
material source: quantity 1
```

Command:

```text
storeInputMaterialFx(...)
```

Actual result:

```text
one producer runtime item remains
producer quantity = 2
material location = input owned by that producer
producer is now impure
checkRuntimeFx issues = []
```

Expected result:

```text
one producer quantity 1 remains under the original owner identity
one pure producer quantity 1 is placed through standard placement
only the isolated original owner receives the input and becomes impure
```

The current result semantically claims that one buffered material belongs collectively to two producer instances represented by one stack record. That contradicts the identity model.

## Reproduction B — failed remainder placement does not rollback

Initial state:

- stacked owner quantity 2;
- source material is only partially consumed, so its original cell remains occupied;
- all other board and inventory capacity is full.

Desired operation requires splitting the owner, but there is nowhere to place the remainder.

Actual result:

```text
storeInputMaterialFx succeeds
input is attached to owner quantity 2
```

Expected result:

```text
command fails
runtime is reference/deep equal to the pre-command runtime
no quantity change
no input attachment
no events
no visual change
```

This directly violates the agreed atomic interaction scenario.

## Reproduction C — active job on a stacked producer

A stackable producer with a simple-input line can start directly while quantity is 2.

Actual result:

```text
one producer runtime item
quantity = 2
active job owned by the item
runtime checker accepts the state
```

Expected result:

```text
one isolated producer quantity 1 owns the active job
remainder quantity 1 follows standard placement
```

Therefore this is not a craft-only issue and should not be fixed by extending `splitCraftOwnerForStartFx` with more `if (type === ...)` branches.

## Required root fix

Introduce one focused primitive for **isolating one instance before or while attaching identity-bound state**.

It now has at least two concrete callers, so a shared abstraction is justified:

- input storage;
- line start.

A suitable conceptual contract:

```text
isolateStatefulOwnerFx
  input: owner ID + candidate runtime
  behavior:
    - read the live owner from the candidate runtime
    - if quantity === 1, return unchanged runtime
    - require the owner to be in a location from which standard remainder placement is defined
    - revise the surviving original owner to quantity 1
    - place quantity - 1 through the standard placement path
    - return the complete candidate runtime
```

The exact name may differ. Avoid turning it into a generic mutation-builder framework. It should own one domain sentence only.

### Ordering

The best current pattern is the one already used by craft start:

```text
resolve against fresh runtime inside modifyRuntimeFx
→ attach the new state to the surviving owner in the candidate draft
→ owner becomes impure
→ isolate quantity 1
→ standard-place the pure remainder
→ apply remaining operation steps
→ validate complete candidate
→ one commit
```

For input storage, attaching or moving the source first can be useful because a fully consumed source may free a board cell for the remainder. The operation must still remain one candidate runtime and one commit.

The implementation must not publish intermediate events or mutate canonical state before all placement succeeds.

---

# P1 — Runtime accepts impure stacks

The canonical runtime checker must enforce the purity model independently of command call sites and save provenance.

Current validation covers:

- stack quantity above configured max stack size;
- global max count;
- active craft job owner quantity not equal to one.

It does not cover:

```text
item.quantity > 1
+ isItemPureFx(item, runtime) === false
```

The producer-input reproduction proves such a state passes with zero issues.

## Recommendation

Replace the craft-specific quantity issue with a generic issue, for example:

```text
item:impure-stack
```

with evidence:

```ts
{
  type: "item:impure-stack",
  itemId,
  canonicalItemId,
  quantity,
}
```

The checker only needs to evaluate purity for items whose `quantity > 1`, keeping the expensive relational query narrow.

This invariant protects against:

- future command bugs;
- malformed or migrated saves;
- direct internal helper misuse;
- new state dimensions added to `isItemPureFx` later.

Once this exists, a specialized `job:craft-owner-quantity` issue becomes redundant unless it provides uniquely useful diagnostics. Prefer one canonical invariant over two overlapping definitions.

---

# P2 — Documentation closes a narrower contract than the domain requires

`@chat-gpt/CURRENT.md` currently says generic stack and quantity mutation require purity, and documents craft split during start.

That is true but incomplete. It does not state the more important write-side invariant:

> Every operation that turns a pure item instance into an impure one must isolate one quantity from a stack atomically.

Because the active project memory is used as implementation guidance for future LLM sessions, this omission is dangerous. A future feature could correctly use `isItemPureFx` for stack targeting while again attaching charges, temporary lifetime, memory state, stash state, or deposit capacity to an entire stack.

Update the canonical decision after implementing the root fix. Do not document only craft/input special cases.

---

# Test gaps and required regression matrix

Current tests thoroughly cover purity reading, pure stack target selection, stale target rejection, line closure, craft schema, and the existing craft start split. They do not cover the operation that *creates* impurity on a stack.

Add permanent tests for:

1. **Stacked producer input store**
   - input attaches to exactly one isolated instance;
   - original owner ID remains with the impure instance;
   - remainder uses standard placement.

2. **Stacked craft/stash first input**
   - same generic isolation behavior;
   - no feature-specific placement path.

3. **Fully consumed source frees placement capacity**
   - source cell may be reused by the remainder within the same candidate runtime.

4. **Partially consumed source with full board/inventory**
   - command fails;
   - runtime and event stream remain unchanged.

5. **Fresh-runtime concurrency regression**
   - preview/read sees free capacity;
   - another write fills it;
   - authoritative command replans inside `modifyRuntimeFx` and rejects without partial state.

6. **Generic line start on a stacked producer**
   - exactly one instance owns the job;
   - remainder is standard-placed.

7. **Generic runtime invariant**
   - impure quantity greater than one is rejected for buffered input, active job, queued request, and future item-owned state.

8. **Purity restoration**
   - after the last identity-bound state disappears, the item becomes pure again and may be selected as a stack target.

9. **Failed isolation emits no transient events**
   - candidate rollback remains fully invisible to UI/save/event consumers.

---

# Mental-load and architecture assessment

## Good

The purity query has one obvious entry point and compositional helpers. As an LLM, I can answer:

```text
Why can these items stack?
→ same canonical item + both isItemPureFx
```

Closed input also has one named policy query and one typed error.

The craft schema narrowing is local and easy to discover from the item schema path.

Removing `excludedStackItemIds` reduced placement data plumbing and made the generic planner more truthful.

## Current misleading split

At present, the mental model is incomplete:

```text
placement knows impure items cannot stack
quantity writes know impure items cannot change quantity
but state-creating writes can still create impure stacks
```

That is worse than merely missing a feature because the code appears to enforce a universal purity model while actually enforcing only selected directions of it.

The root fix should make the model symmetrical:

```text
pure stack
→ interchangeable quantities

operation adds identity-bound state
→ atomically isolate one instance

impure item
→ quantity exactly one and never a stack target

state fully disappears
→ item becomes pure and interchangeable again
```

Once that sentence is true in command paths and runtime validation, the architecture will again be easy to reason about.

---

# Do not do

- Do not add another `excluded...Ids` or `closed...Ids` parameter through placement layers.
- Do not create `splitCraft...`, `splitProducer...`, and `splitStash...` variants for the same identity operation.
- Do not persist an `isPure` flag.
- Do not compare impure runtime state by deep equality to decide stack compatibility.
- Do not make UI split stacks or sequence multiple commands.
- Do not commit the split before remainder placement and try to compensate afterward.
- Do not weaken the craft schema back to generic positive capacity and rely on runtime rejection.
- Do not replace the explicit purity helper graph with an opaque generic state introspector.

---

# Suggested implementation order

1. Add a generic runtime issue for `quantity > 1 && !isItemPureFx`.
2. Introduce one focused state-attachment isolation helper using standard placement.
3. Use it from input storage in the same candidate runtime as source/input mutation.
4. Use it from generic line start; retire the craft-only split helper.
5. Add atomic full-capacity and stale-preview regression tests.
6. Update canonical project documentation with the universal invariant.
7. Re-run complete checks and current game validation.

---

# Definition of done

This review can close when all of the following are true:

- no command can produce an impure runtime item with quantity greater than one;
- runtime validation rejects such a state regardless of origin;
- first state attachment to any pure stack isolates exactly one instance;
- remainder always follows standard placement;
- placement failure rolls back the entire state attachment with no events;
- direct start and queued start use the same isolation semantics;
- craft material capacity remains statically zero in authoring;
- closed zero-capacity lines reject new input while active;
- positive-capacity producer lines may continue buffering;
- canonical documentation describes the general invariant rather than craft-only behavior.

---

# Verification performed

Repository state:

```text
HEAD: e3991d3313b56f49a1f3fa406ebb2bc2244f7de0
baseline: 91b28370d2f905665b53fa3df11d77a028c83c4a
git status: clean
review commits: none
```

Passed:

- dependency installation;
- `git diff --check`;
- formatting check;
- dependency-cruiser (`507 modules`, `2084 dependencies`, zero violations);
- source TypeScript check;
- test TypeScript check;
- `game:validate game/arkini`;
- focused changed-area tests (`9 files`, `22 tests`);
- additional targeted suites used during the review.

The complete single-worker Vitest run produced only green results in the emitted output, but did not reach its final summary before the execution timeout in this environment. It is therefore not claimed as a completed full-suite verification here.

Temporary destructive probe tests used to reproduce the findings were removed. The repository remained clean.

## Final verdict

The new purity and closed-input architecture is worth keeping. The schema change is not over-engineered, and the query decomposition is LLM-friendly.

The quest is not ready to close because the central identity invariant is only half implemented. Fix state attachment generically and atomically, add the runtime invariant, and avoid another round of feature-specific exceptions. After that, this will be a strong and elegant foundation for craft, stash, producer, charges, temporary state, and other future impure item lifecycles.
