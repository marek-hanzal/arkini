# Arkini gameplay contract

This document owns implemented gameplay meaning. [`CONFIG.md`](CONFIG.md) owns authoring syntax; [`ARCHITECTURE.md`](ARCHITECTURE.md) owns execution and lifecycle; source and focused tests prove the current implementation.

## World, locations, and stacks

Arkini runs multiple isolated Board spaces plus global Inventory and optional Toolbar storage. A Board cell is `space + x + y`; equal coordinates in different spaces never interact. `currentSpace` selects presentation and passive-storage release destination, but all spaces keep simulating.

A new game applies authored start entries in Board → Inventory → Toolbar order against one evolving candidate Runtime. Board space and coordinates plus Inventory/Toolbar slots are exact; every entry uses canonical placement, and `currentSpace` plus the complete initial state commit atomically or not at all.

Spatial mechanics—distance, placement, merge, charge targeting, and output—remain in their origin space. Inventory and Toolbar are the only bridges between spaces and are passive storage:

- active/ready jobs pause and queued work does not dispatch there;
- new line input, job, or queue state cannot attach there;
- moving an already stateful owner there preserves its identity, inputs, job, queue, charges, and remaining time;
- returning it to a Board resumes evaluation against the destination space.

Configured storage scope is `board | inventory | toolbar | any`. Query reach is separate: `board` is the origin-space Board, `inventory` and `toolbar` are their global surfaces, `any` is the origin-space Board plus both passive surfaces, and `universe` is every Board plus both passive surfaces. `universe` is not a storage scope.

Only compatible pure items stack, up to `maxStackSize`. Purity is derived from live state: an item is impure when it or an owned line carries identity-bound state such as input, a job, a queue request, or a partial charge count. An impure item has effective stack size `1`.

When a Board operation first attaches state to a stacked identity, the original identity becomes quantity `1` and the pure remainder uses standard placement in the same atomic transition. Failure to place the remainder changes nothing. Generic stack/quantity operations accept only pure items.

## Lines, intent, and delivery

Producer, craft, blueprint, and stash items share one line lifecycle. Input filling is passive and never starts work. Enqueue is the player-facing execution command: it appends explicit intent after validating the owner, line, rules, non-material requirements, charges, output capacity, and queue capacity. Missing concrete material may wait.

A queued request is not a job. It owns no time, material, charge, or reservation. Only the FIFO head of an idle Board owner is considered, in canonical global queue order. A blocked head stays first and retries against fresh Runtime facts; nothing overtakes or silently removes it. The player may clear all pending requests for one owner without affecting its active job, charges, consumed material, or reservations. Clearing atomically returns unused buffered roots for the removed request lines and reverses their outbound deliveries through canonical placement; if a buffered root cannot be returned, nothing is cleared.

At a fixed-step boundary, queue playback may Autofill useful concrete material through canonical deliveries while retaining the request. Delivery travel is persisted engine state with fixed-step remaining duration. The material becomes available only when Tick settles delivery into input storage. Renderer geometry/contact never admits material or starts work. A missing or invalid soft target returns the same leased actor, including a partial remainder, to its persisted origin.

Only after required material has settled may a later queue pass create the job and remove its request. Start re-resolves every live fact and commits input ownership, charge spending, stateful-stack isolation, output reservations, and the job atomically.

## Tick, jobs, and temporary items

Effect Clock is the production wall-clock source; simulation advances in canonical 100 ms fixed steps. A long elapsed interval equals the same sequence of explicit steps. Session-only observation/remainder state is not persisted, and an attempted complete step is acknowledged once even when advancement fails.

Jobs persist only:

```text
durationMs
remainingMs
```

Runnable jobs decrement by one step, clamped at zero; paused jobs do not. Completions settle in stable job-ID order. Work admitted during that boundary receives no retroactive time. Started jobs cannot be cancelled.

Temporary items are Board-only, identity-bound, and non-stackable. Each persists `remainingDurationMs`, initialized from authored `durationMs`; identities present at a step boundary lose one step. Job output created in the current step starts at full duration. Ready temporaries expire after job completion in stable runtime-ID order. Expiry removes the item, resolves optional deterministic output from its released origin, and rolls back to the same zero-duration item if placement fails.

## Material ownership

Material input uses one exact canonical item selector and one of two modes:

- `consume`: the material stays intact while buffered; start discards its passive owned subtree, moves only the inaccessible root into `job` scope, and completion destroys it permanently. Conversion is not charge depletion and emits no depletion output.
- `reserve`: start moves the same live instance into `reserved` scope. Completion relocates it from the owner's current Board origin. Pure material may normalize into ordinary stacks/identities; impure material preserves exact identity and needs one exclusive cell.

Neither mode remembers historical stack, slot, or position. Job-owned material is inaccessible to generic mutations. A zero-capacity material input closes while its line runs; positive capacity remains open as storage. Temporary items cannot enter material input.

Removing an authored idle Board owner releases its buffered roots through canonical existing-item placement in the same transition. A loaded passive owner must return to a Board first because no passive coordinate is reinterpreted as a Board origin. Any blocked release rolls the removal back.

## Charges and completion

An item may author finite `charges.amount` and optional depletion output. Missing live `remainingCharges` means the fresh full amount and remains pure. Input costs charge either the line owner (`self`) or the deterministic Board target of a deposit input (`target`). Queueing pays nothing.

Start reserves charge budget by runtime payer across the entire line, aggregates all costs per payer, and spends each payer once. Partial spending stores identity-bound charge state and isolates one stack quantity. Full idle depletion consumes one quantity in place. Idle external payers die and emit depletion output during start; an active owner may remain at zero until its job completes.

Completion removes the ready job and consumed roots in one candidate, keeps reserved roots live, then applies this order:

```text
remove a depleted owner and its queue
→ place optional line output
→ place optional owner-depletion output
→ release the depleted owner's buffered inputs
→ relocate reserved instances
```

A non-depleted owner, its buffered storage, and pending queue remain. Any charge, placement, capacity, or return failure preserves the pre-completion state for retry. One blocked owner does not prevent independent owners from advancing.

## Output capacity and randomness

Every active job reserves the worst possible future quantity of each canonical output against `maxCount`, including deferred owner-depletion output. Fixed quantities reserve their value, ranges their maximum, chance rolls success, repeated weighted rolls the worst candidate for every draw, rolls in a selected set add, and alternative sets use the per-item maximum. Queued requests reserve nothing.

All quantity-creating paths and hydration include active-job reservations. Completion removes its own job before placement, spending rather than double-counting its reservation. Quantities that the same completion destroys—consumed material and a depleted owner—offset output of that canonical item. Immediate external depletion output is live output during start, not a later reservation. Overbooking rejects the whole candidate.

Randomness derives from stable canonical identities and explicit algorithm versions, never Tick or wall time. Unchanged blocked start/completion/expiry retries therefore resolve the same rolls and placement order.

## Placement and merge

One scope-aware placement policy serves ordinary drops, line/depletion/expiry output, reserved-instance relocation, buffered release, and initial placement:

```text
validate live + reserved maxCount
→ apply authored scope and Board strategy
→ fill compatible pure stacks
→ spawn into empty locations
→ require the complete quantity
```

`drop` starts from the supplied origin; `random` chooses one Board origin, including occupied cells, then uses the same stack-first, nearest-first policy. An `any` item may fall back Board → Inventory → Toolbar, never another Board. Existing pure items may normalize; impure items keep exact identity and require one empty cell. Partial placement is forbidden and rolls back the owning mutation.

Directional merge is one canonical gameplay command. The source item owns ordered rules; the first exact target selector wins and reverse matching is never inferred. One source quantity is consumed or used, one Board target is kept/removed/replaced, optional output uses ordinary placement, and a used source returns through ordinary placement. Source action, target effect, output, return, validation, and event commit together. Same-item stacking is separate from merge.

## Cheats, save, and presentation

Cheat availability is application preference; enabled cheat state, including Instant gameplay, is Runtime state. Instant settles valid time-based jobs and temporary lifetimes through the same authoritative engine without changing Tick units. Hard reset is renderer lifecycle: discard the exact Game without final save, clear only its verified save, then acquire a fresh Game. It is not an authored item command.

Serializable State contains items, deliveries, jobs, queues, current space, and gameplay cheat state—not wall-clock timestamps, Tick observation cursors, transient events, or UI state. Hydration strictly validates the current shape and invariants. Matching-major compatibility is defined only by [`VERSION.md`](VERSION.md).

[`src/game-event`](src/game-event) owns strict transient facts projected from already-applied transition results. Event-only commits do not mutate Runtime. Transition subscribers observe current-plus-tail, while event subscribers discard that current replay. Slow presentation callbacks cannot delay Runtime, Tick, save, or another subscriber. A failing callback cannot roll back or stall its triggering commit or peer delivery; afterward, the existing fatal session fail-stop applies.

Presentation may trail canonical Runtime and may redirect, shorten, collapse, or skip choreography. It never determines readiness, validity, placement, queue/job state, Tick progress, save, or event publication; a new subscriber never receives old events merely because another surface is still animating them.

Do not add job cancellation, wall-clock job timestamps, reverse reservation history, queue overtaking, partial output, passive-storage production, or gameplay truth reconstructed from UI/events without an explicit new product design.
