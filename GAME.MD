# Arkini gameplay contract

This document describes gameplay semantics implemented by the current engine and explicitly marked authoring capabilities that are not runtime-backed yet. It does not describe historical systems, speculative wish lists, or UI-specific animation details.

Configuration owns concrete content and balance. This document owns the interpretation of current mechanics and the boundary between executable behavior and schema-only intent.

## 1. Game shape

Arkini is a client-only, offline merge and production game played across multiple isolated board spaces and one shared inventory.

The current engine lets callers create and move items, navigate persistent board spaces, store line materials, start and queue product lines, advance deterministic jobs, execute directional merges, resolve configured outputs, and place resulting quantities through one shared policy. Remaining schema-only utility capabilities are listed later in this document.

Every board space uses the board size from game metadata; the shared inventory uses its own configured size. They are not fixed engine constants.

## 2. Items and locations

Every live item is a runtime instance of one canonical configured item.

Configured storage scope determines whether the item may occupy:

- board;
- inventory;
- either grid.

Runtime may additionally place material representations into:

- a specific owner line-input slot;
- a consumed job material or live reserved material.

Input and job locations are ownership states. They are not visible storage grids and cannot be manipulated as normal board/inventory items.

## 3. Board and inventory

Every board space is an active spatial surface. Board cells are identified by mandatory `space + x + y`, and equal coordinates in different spaces never collide. All spaces continue simulating together; `currentSpace` only selects the presented board and the destination of explicit inventory-to-board placement.

Spatial mechanics never cross directly between boards. Placement, distance, merge, charges, outputs, and release stay inside their origin space. The shared inventory is the only bridge between spaces.

Inventory is passive storage:

- active and ready jobs pause while their owner is in inventory;
- queued work does not dispatch while the owner is in inventory;
- board-origin rules cannot use inventory coordinates;
- new input, job, queue, or other identity-bound state cannot be attached there;
- returning the same owner to the board resumes normal evaluation.

Moving an item to inventory is not item removal. Instance state, jobs, queue requests, buffered inputs, and remaining time stay attached to the same owner.

## 4. Stacks

Compatible pure items may share one runtime stack up to the configured `maxStackSize`. An impure item has an effective stack size of `1`.

A line becomes non-pure when it owns buffered input, an active job, or a queued request. An item is pure only when all of its lines and any item-owned lifecycle state are pure. A passive empty producer or craft can therefore stack; the same runtime item becomes non-pure as soon as state attaches to its identity.

Placement fills compatible pure stacks before spawning additional item instances in empty locations. Generic stack and quantity commands reject non-pure items.

When a board command first attaches identity-bound state to a stack, the original runtime identity keeps that state at quantity `1` and the remaining pure quantity follows standard placement. The attachment, split, remainder placement, and emitted events are one atomic mutation. If the remainder cannot be placed, nothing changes.

Stack handling is automatic. Gameplay commands should operate on quantities rather than require the player or UI to normalize stacks manually.

## 5. Current public gameplay operations

The implemented write surface includes:

- initialize a runtime from game configuration or persisted state;
- spawn an item;
- move an item;
- swap two grid items;
- remove an eligible item;
- set an item stack quantity;
- place a resolved drop or output;
- store material into a line input;
- start a line immediately or queue its request;
- advance runtime time through the Tick service.

Every write uses the canonical serialized mutation boundary. UI must not invent additional state transitions around these commands.

## 6. Product lines

Producers, crafts, blueprints, and stashes expose the shared product-line model. They use one input, start, queue, max-count, deterministic output, placement, and completion lifecycle. Separate item schemas remain for authoring identity and presentation, but item type does not decide output interpretation or whether the owner survives completion.

A line owns:

- runtime duration;
- input requirements;
- optional output;
- visibility, enable, disable, and runtime rules.

Filling an input is passive. It never starts work automatically.

Work starts only through the explicit line-start command.

## 7. Input buffering

Delivered materials may be stored in a specific owner/line/input slot before start. Delivering the first material to a stacked owner isolates one stateful owner instance before commit; this is shared line behavior rather than a producer, craft, blueprint, or stash exception.

An input accepts only matching material and only up to its required quantity plus configured extra capacity. During an active job, a zero-capacity input is closed and rejects new delivery; a positive-capacity input remains open as storage. A queued request does not close the input.

Removing an idle board owner releases every direct buffered root through canonical existing-item placement in the same atomic mutation. The released owner position is the single board origin; normal scope policy may still place an allowed item into inventory when board capacity is exhausted. A loaded owner in passive inventory must return to the board before removal because inventory coordinates are never invented as a board origin.

Buffered material retains no historical stack, slot, or position. Pure roots may normalize into ordinary stacks and identities. Impure roots preserve their exact runtime identity, state, and passive owned subtree.

If any release cannot be placed, owner removal and all releases roll back.

## 8. Starting work

Starting resolves the live owner and live line from the pre-command serialized runtime. The command's own atomic consequences may change later runnability; the first Tick can therefore pause a job whose start created a new nearby item or otherwise changed line rules. Start does not re-resolve midway through its own candidate transformation.

A start validates:

- owner existence and revision;
- board location;
- line existence;
- live line rules;
- required input readiness;
- active job and queue state;
- queue capacity.

An owner may have at most one active job.

If the owner has no active job and no queued request, an eligible start begins immediately.

Otherwise the request is appended to FIFO when capacity allows.

A queued request:

- is not a job;
- owns no time;
- consumes nothing;
- reserves nothing;
- stores only the stable information needed to retry the start;
- may be discarded only by explicitly clearing the whole pending queue of its owner.

## 9. FIFO behavior

Queued work starts through the same internal pipeline as an immediate start.

The oldest request is always considered first.

A retryable blocked head remains at the front. Work behind it may not overtake it. The head keeps retrying against fresh runtime facts, so a later matching deposit or other restored requirement may unblock it. The engine never silently discards pending work.

The player may explicitly clear every pending request of one owner. Clearing a queue does not cancel or modify an active job, return materials, spend or restore charges, or create output. Repeating the command on an empty queue is a safe no-op.

Queue-only owners are valid runtime state and are retried at fixed-step boundaries.

Missing owner, missing line, or structural corruption is not a retryable queue block and must surface as a real failure.

## 10. Jobs and time

A job stores:

```text
durationMs
remainingMs
```

No wall-clock timestamps are part of a job.

The engine advances jobs in canonical 200 ms fixed steps. A long elapsed interval must produce the same result as the equivalent sequence of fixed steps.

At the start of one fixed step, every owner observes the same step-start runtime facts for time progression.

Runnable jobs decrement by one step, clamped at zero. Paused jobs keep their remaining time.

Completions are applied at the step boundary in stable job-ID order. A queued successor may start at that boundary but receives no retroactive time from the completed step.

Temporary board items store:

```text
durationMs             authored immutable lifetime
remainingDurationMs    persisted runtime lifetime
```

Every temporary identity present at the start of a fixed step loses one step, clamped at zero. Authored durations that are not exact multiples of 200 ms therefore expire on the first fixed boundary at or after their duration. Items created by work completed during the current step begin at the full authored duration and are first advanced by the next step.

After job completion and queue dispatch, ready temporary items expire in stable runtime-ID order. Expiry removes the temporary item and resolves its optional output from the released board origin through the same deterministic output and placement pipeline used elsewhere. A blocked output rolls the whole expiry back, leaves the item at zero, and retries from the same deterministic random stream after later runtime changes create capacity.

## 11. Inputs at job start

Material inputs use one of two modes.

### Consume

Before start, the accepted material remains in its input with its complete owned state. When the job actually starts, its passive owned subtree is discarded without returns and only the consumed root moves into `job` scope. The root remains inaccessible while the job runs and is discarded permanently at completion. Hydration rejects any consumed root that still owns descendants, work, job material, or queued intent. Consuming a charged item does not trigger depletion output because conversion is not charge depletion.

### Reserve

The accepted quantity moves as the same live runtime instance into `reserved` scope and becomes inaccessible to generic item operations. Its identity, remaining charges, and passive owned subtree remain intact. Completion places that existing instance from the current board position of the line owner without remembering its former stack, slot, or position. Pure instances may normalize into ordinary stacks; impure instances preserve identity and require one exclusive cell.

Job-owned materials are not a second inventory and do not remember where they came from. Consume and reserve are both committed only by the authoritative start candidate.

Started jobs cannot be cancelled.

## 12. Charges and completion

Any item may have a finite authored lifetime:

```text
charges.amount
charges.output?
```

Missing live `remainingCharges` means the instance is fresh at the authored full amount. Charge costs are authored on individual line inputs. A self cost charges the owner; a target cost charges the deterministic board item resolved by a deposit input. Here `deposit` names the external-board-target interaction, not a required target item category. Queueing pays nothing. Costs are resolved and paid only when a job actually starts.

All costs for the same runtime payer are aggregated before mutation. The engine spends each payer once inside the same candidate. A partial spend makes one concrete item stateful and isolates it from a stack. Fully depleting an idle quantity consumes one quantity in place. An idle depleted target is removed immediately and emits its optional charge output from its former origin. A payer that owns an active job may temporarily remain at zero charges until that job completes.

A ready job completes only while its owner is on the board. Completion resolves the live job by stable ID, removes the completed job and consumed roots inside one immutable candidate, keeps reserved instances live, and executes one generic lifecycle:

```text
remove the owner when it is depleted
→ resolve optional line.output
→ resolve optional depleted-owner charges.output
→ release depleted-owner buffered inputs
→ relocate the same live reserved instances
→ commit everything atomically
```

A non-depleted owner remains available for later starts and retains buffered storage and queue state. A depleted owner loses its identity and queue before output placement, so line output gets first access to the freed origin and depletion output follows. Placement, charge, max-count, or return failure is a valid blocked state: the published runtime keeps the job, owner, queue, inputs, reservations, and charges unchanged for retry.

One blocked owner does not prevent unrelated owners from progressing or completing in the same fixed step.

## 13. Future output and `maxCount`

A job may start only when every possible deferred output remains within canonical `maxCount` after accounting for live items and all active jobs. Deferred output includes `line.output` and `charges.output` when the owner has already paid its last charge. Capacity planning uses the worst possible result rather than an average or one sampled roll:

- a fixed quantity reserves its value;
- a range reserves its maximum;
- a chance reserves the successful drop;
- repeated weighted selection reserves the worst candidate for every draw;
- all rolls in one selected set add together;
- alternative sets reserve the per-item maximum.

Queued requests reserve nothing. When the FIFO head attempts to become active, the same charge and max-count checks run; a blocked head stays first. Ordinary output placement, direct drops, direct spawn, and direct quantity mutation cannot consume capacity already promised to active jobs. A completing job is removed from the candidate before its output is placed, so its actual roll spends the reservation. A depleted owner offsets output of its own canonical item by the live quantity that disappears.

Immediate charge output from an idle external target is placed during the start candidate and is not left as a future reservation. After all charge spends, the final start max-count assertion validates the live immediate output together with every active-job reservation, including the job being started. Offline validation additionally catches the narrow exact-item case where unavoidable target costs exceed `charges.amount × finite maxCount`. Failure rolls back the complete start.

## 14. Deterministic output

Line completion and deferred owner-depletion randomness are stable for one job identity and explicit algorithm versions. Immediate external depletion randomness is stable for the unchanged owner, line, payer, quantity, pre-spend charge state, and cost.

Deterministic streams control alternative set selection, chance, weights, quantity ranges, and random placement ordering. A blocked start, blocked completion, or restored saved state therefore retries the same result while the relevant canonical state is unchanged.

## 15. Placement

All runtime-executed output and relocation use the shared placement policy, including:

- generic line output;
- charge-depletion output;
- existing reserved-instance return;
- buffered-input release;
- direct drop/output commands;
- initial placement planning where applicable.

Materialized drops respect configured storage scope, max count, purity and stack size, board/inventory capacity, authored `drop` or `random` board strategy, and origin-based ordering. Existing-item placement uses the same scope and spatial policy: pure items may normalize through ordinary stack placement, while impure items preserve identity and require one exclusive cell. When an allowed board-first placement cannot fit fully on the board, the remainder may continue into inventory.

Partial placement is forbidden. The owning gameplay mutation rolls back if the complete quantity cannot be placed.

## 16. Authored capabilities not fully runtime-backed

The completed configuration accepts more item semantics than the current command surface executes. This is intentional migration state, not permission to pretend the behavior exists.

### Merge

Directional gameplay merge is runtime-backed through `mergeItemsFx`. Source-owned authored rules resolve one revised source against one revised board target; ordinary same-item stack placement and `mergePlacementPlansFx` remain a separate placement concern.

### Line owners and charged items

Craft, blueprint, and stash each expose one ordinary `LineSchema`; producers expose one or more. Positive material capacity is supported only for producer lines and is rejected for the other line owners by game validation. Like every line owner, the first attached input, active job, or partial charge state isolates one quantity from a pure stack. Starting work resolves the line from the pre-command world; changes produced by that same start may make the new job pause on its first Tick. This is intentional command semantics, not a second mid-command resolution.

Every line may omit output and every item type may be persistent or charged. Item type never decides whether the owner survives. A blueprint can drop a random item nearby or produce nothing; its visual remains an explicit standard asset rather than being inferred from output. Deposit inputs are fully runtime-backed deterministic selectors for external charged board targets; deposit is not a separate capacity state system.

### Temporary items

Temporary items are board-only, non-stackable identities with fixed-step `remainingDurationMs`. Creation initializes the full authored `durationMs`; save/restore preserves the remaining value. Tick owns progression and atomic expiry. Optional expiry output uses standard deterministic output plus scope-aware placement, and blocked output keeps the zero-duration item available for retry. Their board-bound lifetime makes them ineligible for material-input storage.

### Utility item kinds

Speed mode is runtime-backed as root session state. `toggleSpeedModeFx()` switches `runtime.session.speedMode` directly between `normal` and `accelerated`; it does not require, mutate, or derive truth from a speed-cheat item. Newly observed wall-clock time is fed into the same fixed-step engine at `1×` or `30×`. Explicit simulation advancement remains unscaled.

The authored speed-cheat item is only the player-facing control and asset projection for that global mode. Its first asset represents accelerated mode and its second asset represents normal mode. Inventory opener, nuke, and cheat inventory remain schema-backed without dedicated runtime commands.

A capability is runtime-backed only when it has an owned command or Tick path and behavioral tests. Schema presence alone is not implementation.

## 17. Save and reload semantics

Serializable state contains live items, active jobs, and FIFO requests.

Tick adapter timing and `runtime.session.speedMode` are session-only and are not persisted. Closing a session may discard a sub-step remainder smaller than one fixed step; loading or creating a session always starts speed mode at `normal`.

Restored jobs continue from persisted `remainingMs`. No due time is reconstructed from wall-clock history.

Restored temporary items continue from persisted `remainingDurationMs`. Legacy state without that field initializes a temporary item at its full authored duration; no wall-clock lifetime is reconstructed.

Invalid persisted state must fail close to hydration or runtime validation. Do not silently invent missing job, reservation, or queue history.

## 18. Presentation lag

Canonical runtime changes immediately when a command or Tick transition commits.

UI animation is intentionally allowed to lag behind. It may visualize an older transition while runtime has already advanced further.

This is valid provided that:

- animation state never becomes gameplay truth;
- engine progress never waits for animation;
- new engine events may redirect or supersede presentation;
- a new subscriber does not replay historical engine events merely because another surface is still animating them.

## 19. Hard exclusions and pending work

Hard exclusions without a deliberate new design:

- job cancellation;
- wall-clock job timestamps;
- reverse reservation history;
- partial output placement;
- queue overtaking;
- inventory job progression;
- gameplay state reconstructed from UI animation or transient events;
- consumer mutation of committed runtime snapshots as an API feature.

Pending capabilities must be implemented through canonical engine boundaries rather than UI patches:

- directional merge execution;
- deposit capacity and depletion;
- utility-item commands.
