# Arkini v1 — craft start split deep review

**HEAD:** `91b28370d2f905665b53fa3df11d77a028c83c4a`
**Baseline:** `fc64bee207bf8f89af2d36fbb72f238289ed8dd8`
**Review mode:** independent, no repository changes or commits

## Executive verdict

The craft architecture slice is directionally correct and materially improves the engine:

- specialized completion is dispatched through explicit producer, craft, blueprint, and stash branches;
- shared live completion facts are resolved once;
- no speculative generic “special item framework” was introduced;
- a stacked craft is isolated at start instead of being retroactively untangled at completion;
- completion remains deterministic and atomic;
- the separated remainder follows standard placement and can start an independent job;
- engine/UI and canonical transition boundaries remain clean.

The mini decision **“split one craft quantity at start” is the right model**. An active craft job owns one concrete runtime item with quantity `1`; completion can then consume exactly that identity without interpreting a historical stack.

The slice is not ready to close yet. Two P1 invariant gaps allow ordinary engine operations to destroy that isolation or leave input state owned by a craft that completion removes.

---

# Findings

## P1 — active craft owners remain legal stack targets and quantity-mutation targets

### Problem

`splitCraftOwnerForStartFx` locally passes:

```ts
excludedStackItemIds = [
  owner.id,
  ...runtime.jobs.map((job) => job.ownerItemId),
]
```

through the entire placement stack:

```text
splitCraftOwnerForStartFx
→ applyOutputPlacementFx
→ planDropPlacementFx
→ planDropScopePlacementFx
→ planBoard/InventoryPlacementFx
→ planScopePlacementFx
→ readAvailableStackItemsFx
```

This prevents the split remainder from immediately merging back into its running owner. It does **not** establish the actual engine invariant:

> An active craft job owner must remain an isolated quantity-one runtime item until completion.

Every other ordinary placement call still considers the active craft owner a compatible non-full stack. `setItemQuantityFx` also accepts it because only job-scoped reservation items are protected.

### Reproduced behavior

1. Spawn one stackable craft with quantity `1`.
2. Start its job.
3. Place one ordinary drop of the same canonical craft item near the owner.
4. Generic stack-first placement merges the drop into the active owner.
5. Runtime validation accepts:

```text
active craft owner quantity = 2
active job still exists
```

6. Completion defects at:

```text
Craft job ... owner ... must represent exactly one quantity.
```

The same corrupted state can be produced directly through `setItemQuantityFx`.

This is not merely a synthetic helper misuse. The authored seed craft has `maxStackSize: 10`, and the game has multiple ordinary sources that can emit `item:seed` while another seed is growing.

### Architectural issue

The optional `excludedStackItemIds` parameter is a local symptom fix and exactly the sort of data hot potato the v1 architecture is meant to avoid. One feature-specific constraint is threaded through seven generic placement layers, while the canonical placement policy remains wrong everywhere else.

### Required target state

The invariant should be owned centrally:

```text
active job owner
→ never a compatible stack target
```

Recommended smallest root fix:

1. `readAvailableStackItemsFx` automatically excludes IDs currently owning active jobs.
2. Make the newly created craft job visible in the internal start draft before remainder placement, so the prospective running owner is excluded by the same canonical rule.
3. Remove the `excludedStackItemIds` plumbing if it no longer has another real policy owner.
4. Add a runtime checker issue for an active craft owner whose quantity is not exactly `1`.
5. Reject explicit quantity replacement of an active craft owner with a typed domain error, rather than relying only on final candidate validation.

Queued-only owners need a deliberate decision. The confirmed invariant is required for **active** jobs. A queued request does not yet own one isolated running quantity.

### Required tests

- ordinary drop of the same craft item does not stack into an active craft owner;
- producer-style output cannot stack into an active craft owner on board;
- output cannot stack into a paused active craft owner in inventory;
- `setItemQuantityFx` cannot change active craft owner quantity;
- corrupted hydrated runtime with active craft owner quantity `> 1` is rejected;
- idle separated craft stacks remain valid stack targets.

---

## P1 — remaining craft input-buffer items become orphaned at completion

### Problem

`completeJobRuntimeFx` detaches:

- the completed job;
- job-scoped reservations.

`completeCraftJobRuntimeFx` then consumes or replaces the craft owner and returns reservations.

It does not handle items still located in the craft owner's input buffer:

```ts
location: {
  scope: "input",
  ownerItemId: craftOwnerId,
  ...
}
```

When the craft owner disappears, those items reference a missing owner. `checkRuntimeInputLocationsFx` correctly rejects the candidate, so the whole Tick step rolls back and the ready craft job can never complete.

### Reproduced behavior A — authored input capacity

A material input requiring `1` with `capacity: 1` legally stores quantity `2`.

Start consumes one quantity and leaves one buffered. On completion:

```text
craft owner removed
buffered quantity remains input-scoped
→ input:owner-missing
→ candidate rollback
→ ready job remains forever
```

### Reproduced behavior B — refill during active job

The bug exists even with default `capacity: 0`:

1. Fill exact required quantity.
2. Start the craft, emptying its input buffer.
3. While the single-use job runs, store another valid material into the now-empty buffer.
4. Completion removes the owner and leaves the refilled input orphaned.

The current generic engine explicitly permits input buffers to refill while a prior job is active. That behavior is useful for persistent producers, but a single-use craft must either reject it or safely release the material when consumed.

### Required target state

Completion of a consumable owner must account for **all state owned by that item**, not only the active job reservation set.

The robust policy is:

```text
craft output/replacement claims capacity first
→ remaining buffered inputs are detached
→ buffered inputs and reservations return through standard drop placement
→ owner, job, output, and all returned materials commit atomically
```

Even if the future read model prevents users from refilling a running craft, completion should still safely handle buffered items from persistence, external commands, or previously accepted state.

Do not preserve original item IDs, source slots, or historical positions. The existing ordinary return-placement rule still applies.

### Implementation shape

Keep this owner-specific. Do not push “all owners release all buffers” into generic completion because persistent producers intentionally retain their input buffers.

A reasonable minimal shape is:

- craft branch reads input-scoped items owned by `context.owner.id`;
- detaches them from the draft before owner consumption/output placement;
- places completion output first;
- returns detached buffered inputs plus reservations through one ordinary release helper.

If `releaseJobReservationsFx` becomes shared by reservations and detached buffered inputs, rename it truthfully instead of passing non-reservations through a lying API.

### Required tests

- excess buffered consume input returns after craft output;
- excess buffered reserve-compatible material returns correctly;
- input refilled while a craft job runs is returned at completion;
- blocked return placement keeps job, owner, buffered inputs, reservations, and output unchanged;
- retry remains deterministic;
- no input-scoped item references the consumed owner after completion.

---

## P2 — start resolution intentionally uses the pre-split world, but this semantic is undocumented

### Current behavior

`startLineRuntimeFx` currently performs:

```text
resolveLineStartFx(runtime before split)
→ accept exact input/rule/runtime plan
→ split craft owner and place remainder
→ apply the previously resolved plan
→ create active job
```

The split can change the board environment used by line rules.

Reproduced example:

- a craft line is disabled when another copy of the same craft exists at `close` distance;
- quantity `2` begins as one stack, so no other item exists away from the origin;
- start resolves as available;
- split places the remainder adjacent;
- the job is created successfully;
- on the first Tick, current rules see the adjacent remainder and the job immediately pauses without progressing.

### Assessment

This is not automatically wrong. It can be a legitimate command semantic:

> Eligibility and initial duration are resolved from the pre-command world; the command's own consequences may alter whether the resulting active job remains runnable.

That is consistent with other world changes being able to pause a running job.

However, it is a non-obvious consequence of the split-at-start decision. It should be explicitly accepted and tested. Otherwise a future implementation thread may “fix” it by re-resolving halfway through the command and accidentally introduce a second plan or inconsistent input allocation.

If the intended semantic is instead that one craft starts only when the **post-split** world permits it, then split must precede the final line resolution inside the same atomic planner, and failed post-split resolution must roll the whole operation back.

Do not leave the behavior accidental.

---

# Architecture assessment

## Completion dispatch split — approved

The new structure is good:

```text
completeJobRuntimeFx
→ resolve live job, owner, line, reservations, deterministic random once
→ remove shared job-owned state from draft
→ explicit owner-type completion branch
```

`JobCompletionContext` carries real shared facts, not speculative abstraction. Producer, craft, blueprint, and stash branches own genuinely different lifecycle ordering. This is SRP applied usefully rather than one file per `if`.

The placeholder blueprint and stash branches also make their partial behavior explicit instead of silently inheriting producer semantics.

## Craft completion orchestrator — approved

`completeCraftJobRuntimeFx` is linear and readable:

```text
assert isolated owner
→ resolve deterministic output
→ replacement or owner removal
→ ordinary output
→ reservation return
```

The owner-specific ordering is visible at one callsite. It should stay explicit rather than being compressed into a generic completion pipeline builder.

## Stack split at start — approved

Splitting at start is better than consuming one quantity from an ambiguous stack at completion:

- job ownership is a concrete runtime identity;
- completion is simple;
- separated quantities can start independent jobs;
- save/load state is unambiguous;
- UI can render one running item and one idle remainder without reconstructing hidden quantity ownership.

The problem is not the decision. The problem is that the resulting isolation is currently protected only by one local placement option instead of a runtime invariant.

## Placement exclusion plumbing — reject in current form

`excludedStackItemIds` is a feature-specific policy value passed through too many generic layers. It increased API surface across placement without making the global placement semantics correct.

Once active owner exclusion becomes canonical, remove this plumbing unless another independent placement policy truly needs caller-controlled exclusions.

## UI and atomic boundary

No regression found:

- craft behavior remains engine-owned;
- UI receives no new gameplay calculation;
- start and completion remain single `modifyRuntimeFx` candidates;
- placement failure rolls back split, inputs, job, owner, and output;
- deterministic completion random remains stable across retries.

---

# Documentation and migration state

The prior comprehensive-review documentation problem is substantially fixed:

- `@chat-gpt/CURRENT.md` is concise and current;
- task queue and coverage are explicit;
- historical implementation is clearly marked as behavioral oracle;
- craft decisions and closeout are documented;
- root architecture/config/code guides now describe v1 rather than the old runtime.

This materially improves LLM maintainability.

The craft task should remain closed only after the two P1 ownership invariants above are fixed and its archived closeout receives the final decisions/tests.

---

# Recommended implementation order

1. Make active job owners canonical non-stack targets.
2. Remove the `excludedStackItemIds` hot-potato path if the canonical rule makes it redundant.
3. Add active craft owner quantity invariant and command guard.
4. Release all remaining craft-owned buffered inputs atomically after completion output.
5. Add targeted regression and authored-flow tests.
6. Explicitly document pre-split versus post-split line-rule semantics.
7. Re-run full architecture, type, validator, and test checks.

Do not redesign STM, Tick, queue, reservations, schemas, or the UI boundary for this slice.

---

# Verification

```text
HEAD: 91b28370d2f905665b53fa3df11d77a028c83c4a
baseline: fc64bee207bf8f89af2d36fbb72f238289ed8dd8
git status: clean
git diff --check: passed
format: passed, 1971 files
dependency graph: passed, 494 modules / 2033 dependencies
source typecheck: passed
test typecheck: passed
game:validate game/arkini: passed
tests: 126 files / 340 tests passed with one worker
review commits: none
```

Temporary destructive probes reproduced:

1. ordinary same-item placement stacks into an active craft owner and makes completion defect;
2. excess buffered craft input makes completion rollback on orphan ownership;
3. refilling a single-use craft input while its job runs produces the same completion failure;
4. pre-split line resolution can create a job that is immediately paused by its separated remainder.

All probe files were removed. Repository remained clean.
