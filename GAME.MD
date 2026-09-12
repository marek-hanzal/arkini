# Arkini gameplay contract

This document owns implemented gameplay meaning. [`CONFIG.md`](CONFIG.md) owns authoring syntax; [`ARCHITECTURE.md`](ARCHITECTURE.md) owns execution and lifecycle; source and focused tests prove the current implementation.

## World, locations, and stacks

Arkini runs multiple isolated Board spaces plus global Inventory and optional Toolbar storage. A Board cell is `space + x + y`; equal coordinates in different spaces never interact. `currentSpace` selects presentation and the Board destination for an Inventory release; that release uses the item's authored scope, tries the current Board before Toolbar for `any`, and never returns to Inventory. All spaces keep simulating.

Each Board cell holds one item stack or one delivery-origin lease. Inventory and Toolbar likewise have one occupant per slot. Birth, output, return and merge replacement use the same occupancy rules; an occupied destination rejects the operation atomically. Board interaction has no layer selection or hidden occupant.

A new game applies authored start entries in Board → Inventory → Toolbar order against one evolving candidate Runtime. Board space and coordinates plus Inventory/Toolbar slots are exact; every entry uses canonical placement, and `currentSpace` plus the complete initial state commit atomically or not at all.

Spatial mechanics—distance, placement, merge, unit targeting, and output—remain in their origin space. Inventory and Toolbar are the only bridges between spaces and are passive storage:

- active/ready jobs pause and queued work does not dispatch there;
- new line input, job, or queue state cannot attach there;
- moving an already stateful owner there preserves its identity, inputs, job, queue, units, and remaining time;
- returning it to a Board resumes evaluation against the destination space.

Configured storage scope is `board | inventory | toolbar | any`. Query reach is separate: `board` is the origin-space Board, `inventory` and `toolbar` are their global surfaces, `any` is the origin-space Board plus both passive surfaces, and `universe` is every Board plus both passive surfaces. `universe` is not a storage scope.

Only compatible pure items stack, up to `maxStackSize`. Purity is derived from live state: an item is impure when it or an owned line carries identity-bound state such as input, a job, a queue request, or a partial unit count. An impure item has effective stack size `1`.

When a Board operation first attaches state to a stacked identity, the original identity becomes quantity `1` and the pure remainder uses standard placement in the same atomic transition. Failure to place the remainder changes nothing. Generic stack/quantity operations accept only pure items.

## Lines, intent, and delivery

Common production lines share one lifecycle. Common owns zero or more `lines`; without lines or an immediate action it is passive. Production uses `maxQueueSize` (default `1`) and ordinary optional material buffers. A default line selects the click action; it does not schedule work automatically. Input filling is passive and never starts work. Enqueue is the player-facing execution command: it appends explicit intent after validating the owner, line, rules, non-material requirements, units, output capacity, and queue capacity. Missing concrete material may wait.

A line may opt into `ahead`: when another line produces its owner item, admission checks whether one future execution fits output count limits. Only marked lines whose authored `show` and `enable` are true participate; one fitting marked alternative permits the intermediate. Unmarked lines do not participate, and owners without applicable marked lines add no downstream gate. The check visits exactly one hop, does not evaluate future runtime rules or material availability, and creates no future job or reservation. It accounts for idle intermediate quantities, pending intermediate outputs, active job reservations, correlated output branches and final-unit depletion output without double-counting active owners. Ordinary direct output limits still apply to every line.

A queued request is not a job. It owns no time, material, unit, or reservation. The persisted global queue retains accepted intent order. Each queue pass traverses that array in order against the latest Runtime draft and selects the earliest actionable request for each idle Board owner. A request makes progress by starting a Job or scheduling useful canonical Autofill delivery while its rules, non-material requirements, units and output limits hold. Only progress marks its owner as handled for that pass; blocked requests may be overtaken. Other owners compete for shared resources in the same global traversal order.

A blocked probe changes no Runtime state, buffered inputs, units, reservations, deliveries, events or gameplay randomness. Skipping preserves the request's identity, line, relative array position and valid line-input ownership. Once actionable again, an older request wins over later requests for that owner. An already travelling delivery alone is not new progress. Active Jobs remain non-preemptive; stored owners cannot dispatch. Each dispatch pass admits at most one progress-producing request per owner, including the separate passes after completion or temporary expiry within the same fixed step. Item Detail retains accepted queue order and reports per-row facts without promising execution order.

The player may clear all pending requests for one owner without affecting its active job, units, consumed material, or reservations. Clearing atomically returns unused buffered roots for the removed request lines and reverses their outbound deliveries through canonical placement; if a buffered root cannot be returned, nothing is cleared.

At a fixed-step boundary, queue playback may Autofill useful concrete material through canonical deliveries while retaining the request. Delivery travel is persisted engine state with fixed-step remaining duration. The material becomes available only when Tick settles delivery into input storage. Renderer geometry/contact never admits material or starts work. A missing or invalid soft target returns the same leased actor, including a partial remainder, to its persisted origin.

Only after required material has settled may a later queue pass create the job and remove its request. Start re-resolves every live fact and commits input ownership, unit spending, stateful-stack isolation, output reservations, and the job atomically.

## Immediate item actions

Common may own one optional `action`, discriminated by `type`. An action and nonempty production `lines` are mutually exclusive. Action availability is determined only by its `rules`: every Enable rule must pass, any matching Disable rule vetoes activation, and no rules means available. There is no authored action enable flag. Optional `input` requirements reuse immediate-action unit admission and settlement.

The `space` action selects its authored `space`. Activation verifies the clicked identity, revision, location and current-space snapshot, then settles requirements and navigation in one transaction. Rejection or blocked depletion output changes neither units nor navigation. Space actions reuse existing Board/Inventory/Toolbar origin policies and never invent a Board origin for a passive payer.

Inventory remains a specialized physical opener: opening, accepting inventory drops, release origins and placement restrictions keep their existing contract.

## Tick, jobs, and temporary items

Effect Clock is the production wall-clock source; simulation advances in canonical 100 ms fixed steps. A long elapsed interval equals the same sequence of explicit steps. Session-only observation/remainder state is not persisted, and an attempted complete step is acknowledged once even when advancement fails.

Output conditions for each start, completion, and expiry use that operation's pre-operation Runtime snapshot. Earlier lifecycle results in the same Tick are visible; partial changes within the current operation are not.

Jobs persist only:

```text
durationMs
remainingMs
```

Runnable jobs decrement by one step, clamped at zero; paused jobs do not. Completions settle in stable job-ID order. Work admitted during that boundary receives no retroactive time. There is no player cancellation command for an active job; expiry of committed temporary material is the one engine-owned abort path.

Temporary items are Board-authored, identity-bound, and non-stackable. Each persists `remainingDurationMs`, initialized from authored `durationMs`; identities present at a step boundary lose one step while on the Board, in delivery, in an input buffer, or committed to a job. Inventory and Toolbar remain invalid temporary storage. Job output created in the current step starts at full duration.

Ready temporaries expire after job completion in stable runtime-ID order, so a job completion tied with its material expiry wins. Expiry output uses the visible Board origin: the item's own cell, its delivery lease, its input owner, or its job owner. The expiry, optional deterministic output, affected-job reconciliation, and reservation returns commit atomically. Failed placement leaves the same zero-duration item in place; an affected active job stays frozen until expiry can settle.

## Scheduled production

`Common.clock` adds periodic admission to ordinary Common production, requiring Board scope, stack size one and at least one line. It uses the same line admission, jobs, Autofill, units, delivery and output operations as manual production. Each pulse attempts the effective Clock line; an admitted request retains that exact line even if the selection changes later. No Clock selection, unavailable admission or a full queue consumes the pulse without hidden debt or choosing another line. Queue capacity counts the active job plus pending requests.

`clock.intervalMs` is at least 100 ms; optional `clock.durationMs` limits active schedule time. Missing duration means unlimited lifetime. Both timers pause while the clock's enable/disable rules deny availability, with Disable retaining veto precedence. An empty Clock selection skips admission but still evaluates rules and ages phase and lifetime normally. There is no separate player on/off state. Sub-step phase remainder prevents rounding drift. Only Board schedule identities present at step start earn the step; material/delivery ownership retains state without running the schedule. Instant gameplay accelerates jobs and deliveries, while admission retains simulation-time cadence.

Line `default` and `clock` are independent authored booleans: at most one line per owner may carry each flag, and the same line may carry both. Editor selection clears only that flag on sibling lines in one update. Conflicting external configurations are rejected. Runtime selection similarly holds one ID per role; missing overrides inherit the authored choice, and `null` explicitly selects none. Changing either role leaves the other role, accepted requests, phase and lifetime unchanged. Default selects the manual click action; Clock selects periodic admission.

Common `control` is optional: omission means `interactive`, while `automatic-only` denies player production commands, material storage/withdrawal, queue changes and both line selections. It leaves ordinary movement, merge and removal policies intact. Interactive players may enqueue any available line independently of Clock, including with no Clock selection or while rules pause the timer. Manual and periodic requests share ordinary queue order and capacity; neither receives priority over previously accepted runnable work.

At a boundary, existing production earns its step before schedule pulses are admitted; work started by a new pulse earns no retroactive time. A pulse exactly tied with the final lifetime boundary still attempts ordinary admission with no queue privilege. Lifetime then closes all new intent. Active jobs and currently startable requests may outlive the schedule under ordinary global queue order. Exhausted owners start no new Autofill and do not wait for incoming material once idle. After the dispatch pass, an exhausted idle owner discards unstartable requests, returns outstanding deliveries and buffered roots through ordinary placement, and atomically disappears with its optional `clock.onExpire` Output. Blocked expiry placement preserves the exact exhausted owner and pending state for deterministic retry; no output or material is lost or duplicated.

## Material ownership

Material input uses one exact canonical item selector and one of two modes:

- `consume`: the material stays intact while buffered; start discards its passive owned subtree, moves only the inaccessible root into `job` scope, and completion destroys it permanently. Conversion is not unit depletion and emits no depletion output.
- `reserve`: start moves the same live instance into `reserved` scope. Completion relocates it from the owner's current Board origin. Pure material may normalize into ordinary stacks/identities; impure material preserves exact identity and needs one exclusive cell.

Neither mode remembers historical stack, slot, or position. Each committed root retains its material input index so live requirements remain attributable. Job-owned material is inaccessible to generic mutations. A zero-capacity material input closes while its line runs; positive capacity remains open as storage. Temporary items may enter material input and keep aging through buffering and active work.

When committed temporary material expires, the job rechecks every material input against its required minimum. Enough remaining committed quantity lets the job continue. Otherwise the engine removes the job and its remaining consumed roots, returns every reservation through canonical placement, preserves queued intent, and produces no line output. Units spent at start are not refunded. A successful expiry immediately retries idle owners' queued requests in global intent order against the resulting Runtime.

Removing an authored idle Board owner releases its buffered roots through canonical existing-item placement in the same transition. A loaded passive owner must return to a Board first because no passive coordinate is reinterpreted as a Board origin. Any blocked release rolls the removal back.

## Units and completion

Units are an item capability independent of its type: passive and manually operated resources use Common, and scheduled production adds Common.clock. A units input selects a Board item with a unit supply; it does not require a special item type.

`quantity` counts item instances in a stack; `units` is the finite supply inside each instance and can represent health, resource stock, or uses.

An item may author finite `units.amount` and optional depletion output. Missing live `remainingUnits` means the fresh full amount and remains pure. Input costs spend units from either the line owner (`self`) or the deterministic Board target of a units input (`target`). Queueing pays nothing.

Start reserves unit budget by runtime payer across the entire line, aggregates all costs per payer, and spends each payer once. Partial spending stores identity-bound unit state and isolates one stack quantity. Full idle depletion consumes one quantity in place. Idle external payers with queued work are skipped when the aggregated cost would fully deplete them. Eligible idle external payers die and emit depletion output during start; an active owner may remain at zero until its job completes.

Completion removes the ready job and consumed roots in one candidate, keeps reserved roots live, then applies this order:

```text
remove a depleted owner and its queue
→ place optional line output
→ place optional owner-depletion output
→ release the depleted owner's buffered inputs
→ relocate reserved instances
```

A non-depleted owner, its buffered storage, and pending queue remain. Any unit, placement, capacity, or return failure preserves the pre-completion state for retry. One blocked owner does not prevent independent owners from advancing.

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

`drop` starts from the supplied origin; `random` chooses a fresh Board origin for every resolved quantity unit, including occupied cells, then places each unit stack-first and nearest-first against the evolving draft. An `any` item may fall back Board → Inventory → Toolbar, never another Board. Existing pure items may normalize; impure items keep exact identity and require one empty cell. Partial placement is forbidden and rolls back the owning mutation.

Directional merge is one canonical gameplay command. The source item owns ordered rules; the first exact target selector wins and reverse matching is never inferred. One source quantity is consumed, used, or has a unit spent through source `spend`; one Board target is kept, removed, replaced, or has a unit spent through target `spend`; and optional output uses ordinary placement. Replacing a temporary target discards its remaining lifetime and initializes the replacement through its own canonical item state. `use` returns the source through ordinary placement without spending units. Each `spend` spends one real unit from its respective participant and runs that item's standard depletion output when the last unit is spent. Source action, target effect, output, return, validation, and event commit together. Same-item stacking is separate from merge.

## Cheats, save, and presentation

Cheat availability is application preference; enabled cheat state, including Instant gameplay, is Runtime state. A fresh Editor Board enables cheats with Default authored timing. Instant settles valid time-based jobs and temporary lifetimes through the same authoritative engine without changing Tick units. Hard reset is renderer lifecycle: discard the exact Game without final save, clear only its verified save, then acquire a fresh Game. It is not an authored item command.

Serializable State contains items, deliveries, jobs, queues, current space, and gameplay cheat state—not wall-clock timestamps, Tick observation cursors, transient events, or UI state. Hydration strictly validates the current shape and invariants. Matching-major compatibility is defined only by [`VERSION.md`](VERSION.md).

[`src/game-event`](src/game-event) owns strict transient facts projected from already-applied transition results. Event-only commits do not mutate Runtime. Transition subscribers observe current-plus-tail, while event subscribers discard that current replay. Slow presentation callbacks cannot delay Runtime, Tick, save, or another subscriber. A failing callback cannot roll back or stall its triggering commit or peer delivery; afterward, the existing fatal session fail-stop applies.

Presentation may trail canonical Runtime and may redirect, shorten, collapse, or skip choreography. It never determines readiness, validity, placement, queue/job state, Tick progress, save, or event publication; a new subscriber never receives old events merely because another surface is still animating them.

Do not add player-driven job cancellation or queue reordering, wall-clock job timestamps, reverse reservation history, partial output, passive-storage production, or gameplay truth reconstructed from UI/events without an explicit new product design.

Production artwork uses the same activity effect for every running job owner. Every owner with an active job uses the same occupied opacity, including jobs waiting for completion placement; passive items retain their normal opacity.
