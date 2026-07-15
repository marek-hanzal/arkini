> **Closed against the generic charges runtime.** The historical `replace` and duplicate owner-removal findings were structurally superseded when output replacement and `afterCompletion` were removed. Runtime hydration now validates live plus active-job worst-case maxCount reservations through the same canonical reader as commands. Impure consume is deliberately supported as deep destructive conversion: owned state is discarded at authoritative start, the consumed root remains job-owned until completion, and nothing is returned. Shards already run with one worker; the remaining runner hang is a separate legacy test-process issue.

# Arkini v1 line lifecycle deep review

**HEAD:** `1994f7f81f454c9ff5fa9d234c779a7b5712090c`  
**Baseline:** `e3991d33`  
**Review mode:** read-only, no repository commits

## Executive verdict

This update is a real architectural improvement.

The previous craft/blueprint/stash-specific completion shapes have been replaced by one authored model:

```text
item owns LineSchema
+ optional line.output
+ item.afterCompletion keep/remove
```

Runtime completion now executes one generic lifecycle instead of switching on item type. Purity attachment is also closed through one generic `isolateStatefulOwnerFx`, and the previous feature-specific exclusions are gone.

The code is easier to understand as an LLM and offers materially better gameplay authoring flexibility. I do not recommend reverting or re-splitting the normalized model.

The slice is not fully closed yet. I found two concrete contract holes and one generic identity-consumption decision that must be resolved. None requires item-specific runtime branches.

---

## What improved

### 1. Completion is genuinely data-driven

Deleted specialized helpers:

- `completeProducerJobRuntimeFx`
- `completeCraftJobRuntimeFx`
- `completeBlueprintJobRuntimeFx`
- `completeStashJobRuntimeFx`
- `placeJobLineOutputFx`

The new path is short and coherent:

```text
completeJobRuntimeFx
→ resolve live job, owner, line, reservations
→ detach ready job + reservations from candidate
→ resolve ordinary line.output
→ apply authored afterCompletion
→ release removed-owner inputs
→ release reservations
```

This is better than four lifecycle implementations that slowly diverge.

### 2. Item-specific code is contained at legitimate structural boundaries

The remaining type branches are mainly:

- producer owns `lines[]` while craft/blueprint/stash own one `line`;
- producer has authored queue size while other line owners use their own queue policy;
- semantic authoring validation currently permits positive input capacity only for producers.

I found no `if item.type === "blueprint"` patch inside generic placement, purity, start, completion, reservation, or output execution.

### 3. Stateful owner isolation is generic and atomic

`isolateStatefulOwnerFx` is now used by both input storage and line start.

The operation first creates identity-bound state in one immutable candidate, then isolates quantity one and standard-places the pure remainder. A failed remainder placement rejects the whole candidate, including input/job state.

This matches the required contract:

```text
state attachment + split + remainder placement
→ one candidate
→ one validation
→ one commit or nothing
```

### 4. Purity is a useful canonical runtime concept

Purity is derived from current runtime ownership, not stored as a flag. Stack limits use the canonical query through `readItemEffectiveMaxStackSizeFx`.

The model is now easy to explain:

```text
pure item → authored maxStackSize
impure item → effective max stack size 1
```

### 5. Schema normalization is proportionate

Keeping separate item schemas while sharing `LineSchema` is a good compromise. The engine gets one line grammar without erasing authoring identity.

`AfterCompletionEnumSchema` is a small, meaningful contract rather than an abstraction introduced merely to reduce repeated text.

### 6. Worst-case maxCount reservation is conceptually strong

The new maximum readers correctly model:

- ranges by their maximum;
- chance rolls as successful;
- weighted repeated choices by repeatable worst candidate;
- alternative sets by per-item maximum;
- removing owners by net same-item increase.

This is the right conservative model for starting work that must later be completable.

---

# Findings

## P1/P2 — Game validation accepts a `replace` target that cannot exist on the board

### Reproduction

A valid compiled config can contain:

```text
line output
→ placement: replace
→ target item scope: inventory
```

`compileGameSourcesFx` returns no diagnostic.

At runtime replacement requires placing the target on the owner's board cell. An inventory-only target can never satisfy this contract, so the job can start but completion is permanently blocked by a static authoring error.

### Why this belongs offline

This is fully knowable from the game config:

- the output placement is `replace`;
- the referenced target item has a canonical scope;
- replacement always creates a board item.

The runtime should not repeatedly discover an impossible authored world.

### Required fix

Extend completion/output validation with a diagnostic such as:

```text
completion:replace-scope
```

For every possible replace drop, require that the referenced target item can exist on the board.

Do this generically over output entries. Do not add blueprint-specific validation.

### Acceptance test

```text
remove owner + replace board-capable target
→ accepted

remove owner + replace inventory-only target
→ compile error at exact output drop path
```

---

## P1/P2 — Runtime hydration does not validate active-job maxCount reservations

### Reproduction

A runtime with:

```text
1 live target item, maxCount 1
+ active ready job guaranteed to output 1 more target
```

returns:

```text
checkRuntimeFx → issues: []
```

The command path cannot normally create this state because job start and later quantity-producing commands respect active reservations. Hydration, migrated saves, manual fixtures, or a changed game config can still provide it.

The accepted job can never complete. Standard placement correctly rejects the actual output, leaving a permanently blocked ready job.

### Root mismatch

The engine now treats worst-case future output as part of canonical maxCount capacity during commands, but `checkRuntimeFx` still validates only live quantities.

That means command validity and hydrated-runtime validity use different definitions of capacity.

### Required fix

Add a runtime issue for:

```text
live canonical quantity
+ worst-case reserved quantity of all active jobs
> maxCount
```

Reuse the existing maximum/reservation readers. Do not reconstruct a second formula in the checker.

Possible issue shape:

```text
job:output-max-count
```

or extend the current item max-count issue with explicit reserved quantity. The important part is one canonical calculation and readable evidence.

### Acceptance tests

```text
live 1 / maxCount 1 / active output reservation 1
→ runtime invalid

remove owner of same canonical item / output replacement quantity 1 / maxCount 1
→ runtime valid because net reservation is zero

queued request only
→ no reservation yet
```

---

## P2 — Generic consumption semantics for impure material items are undefined

### Reproduction

The engine currently permits this valid committed state:

```text
inner producer owns buffered input → inner is impure
inner producer is stored as material in outer producer input
```

The store command succeeds and runtime validation accepts the nested ownership tree.

Starting the outer consume line then removes the inner producer identity through the raw material consume path. Its buffered input remains and becomes orphaned. Candidate validation rejects the start with:

```text
RuntimeInvalidError
→ input:owner-missing
```

So the player can perform an accepted input-store operation that produces an input which appears sufficient but cannot be consumed through the configured line.

### This needs a generic policy decision

Do not solve this with:

```text
if source.type === producer / craft / stash / blueprint
```

The real distinction is identity-bound state, not item category.

Reasonable policies:

#### Option A — Consume inputs require pure material

At store or run resolution, reject an impure source for `mode: consume` with a typed error.

Reserve mode may remain separate because reserving preserves identity and later returns the resource.

This is the smallest and clearest policy.

#### Option B — Consumption performs lifecycle-aware identity removal

Consuming an impure item must settle all state owned by that identity, for example release buffered inputs and reject active work atomically.

This is more flexible but has much larger gameplay semantics and must be deliberately designed.

### Recommendation

Prefer Option A unless consuming loaded/stateful items is an explicit gameplay requirement.

The key invariant should be visible before commit and should never surface as a generic `RuntimeInvalidError` after the UI has already accepted the material.

### Acceptance tests

```text
pure item into consume input
→ accepted

impure item into consume input
→ typed rejection before unusable buffered state is committed

impure reservable resource, if explicitly supported
→ identity and owned state survive reservation and release
```

---

## P3 — Completion removes a `remove` owner twice

`completeLineJobRuntimeFx` currently:

1. removes a non-replaced remove-owner before ordinary output placement;
2. after output placement, calls `removeRuntimeItemIdentityFx` again for every remove-owner.

For replacement output the placement already removes the origin. For non-replacement output the pre-placement branch already removed it. The second removal is therefore redundant in both paths and relies on the helper's current idempotent filtering behavior.

This is not a state bug today, but it adds needless mental noise at the most sensitive lifecycle orchestrator.

Recommended simplification:

```text
remove/no replace → remove before output
remove/replace → replacement plan removes owner
keep → never remove

then release removed-owner inputs
```

Do not add flags or a helper hierarchy merely to remove four lines. A small explicit branch is enough.

---

## P3 — Test shards do not constrain worker oversubscription

The new six deterministic shard scripts improve repeatability of file partitioning, but each shard still uses Vitest's default worker count.

In this environment, `npm run test:shards` completed shard 1 and then stalled in shard 2. Running with `--maxWorkers=1` progressed predictably. The complete single-worker suite printed only green tests but exceeded the environment's final-summary timeout because the suite is now materially larger.

If the purpose of sharding is stable CI/agent execution, add an explicit small worker count to shard scripts, for example one or two workers. File sharding and worker limiting solve different problems.

This is tooling quality, not an engine defect.

---

# Mental-load review

## Better than the previous model

The largest improvement is that item type no longer determines completion meaning.

Previously, understanding completion required asking:

```text
is this producer, craft, blueprint, or stash?
which specialized helper owns output?
which proprietary field contains result?
which branch removes/replaces owner?
```

Now the questions are:

```text
what does line.output resolve?
what placement did authoring request?
what does afterCompletion declare?
```

That is a substantial reduction in simultaneous concepts.

## Long path that remains acceptable

The full start path is roughly:

```text
resolve line
→ exact input plan
→ create job
→ apply input plan
→ reserve worst-case maxCount
→ isolate newly stateful owner
→ validate candidate
→ atomic commit
```

It crosses several small files, but each edge answers a real question. I would not collapse this into a large start orchestrator or generic pipeline builder.

## Item-specific branches are currently healthy

The remaining type matches in `readItemLineFx`, `readItemLineEntriesFx`, `readItemQueueSizeFx`, and `isItemPureFx` are structural adapters over separate schemas. They are not gameplay exceptions.

The semantic capacity validator contains an explicit `producer` capability decision. This is acceptable because it is an authoring support boundary, not a special runtime path. If positive capacity later becomes supported by another line owner, this rule can be generalized without touching input runtime behavior.

## Do not over-refactor

Avoid:

- merging all line-owning item schemas into one giant schema;
- replacing `afterCompletion` with inferred item-type behavior;
- recreating specialized completion helpers;
- passing feature-specific exclusion arrays through placement;
- introducing an abstract line-owner class/capability framework;
- deep-equality state comparison for purity.

The current explicit normalized grammar is a good LLM-friendly tradeoff.

---

# Suggested implementation order

1. Add replace-target scope validation.
2. Add active-job maxCount reservation runtime invariant.
3. Decide and document impure consumable-material semantics.
4. Implement the selected generic policy and tests.
5. Remove the redundant second owner removal.
6. Optionally pin shard worker counts for agent/CI stability.

Do not combine these into a broad lifecycle refactor. The normalized model itself is good.

---

# Checks

```text
HEAD: 1994f7f81f454c9ff5fa9d234c779a7b5712090c
baseline: e3991d33
git status: clean
git diff --check: passed

format: passed, 2010 files
dependency graph: passed, 515 modules / 2137 dependencies / 0 violations
source typecheck: passed
test typecheck: passed
game:validate game/arkini: passed

permanent test files: 144
full single-worker run: only green suites observed; environment timed out before final summary
review probe files: removed
commits during review: none
```

## Final status

```text
Normalized line lifecycle: APPROVED
Generic purity/stateful-owner isolation: APPROVED
Item-specific leakage: NOT FOUND
Quest closeout: NOT YET
```

The remaining work is contract closure around the new generic model, not evidence that the model was a mistake.
