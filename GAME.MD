# Arkini gameplay contract

This document owns implemented gameplay meaning. [`CONFIG.md`](CONFIG.md) owns authoring syntax; [`ARCHITECTURE.md`](ARCHITECTURE.md) owns execution and lifecycle; source and focused tests prove the current implementation.

## World, locations, and stacks

Arkini runs multiple isolated Board spaces plus global Inventory and optional Toolbar storage. A Board cell is `space + x + y`; equal coordinates in different spaces never interact. `currentSpace` selects presentation and the Board destination for an Inventory release; that release uses the item's authored scope, tries the current Board before Toolbar for `any`, and never returns to Inventory. All spaces keep simulating.

Each Board cell holds one item stack or one delivery-origin lease. Inventory and Toolbar likewise have one occupant per slot. Birth, output, return and merge replacement use the same occupancy rules; ordinary placement into an occupied destination rejects the operation atomically. Explicit forced removal may discard capacity overflow within its atomic transition. Board interaction has no layer selection or hidden occupant.

A new game applies authored start entries in Board → Inventory → Toolbar order against one evolving candidate Runtime. Board space and coordinates plus Inventory/Toolbar slots are exact; every entry uses canonical placement, and `currentSpace` plus the complete initial state commit atomically or not at all.

Spatial mechanics—distance, placement, merge, unit targeting, and output—remain in their origin space. Inventory and Toolbar are the only bridges between spaces and are passive storage:

- active/ready jobs pause and queued work does not dispatch there;
- new line input, job, or queue state cannot attach there;
- moving an already stateful owner there preserves its identity, inputs, job, queue, units, and remaining time;
- returning it to a Board resumes evaluation against the destination space.

Configured storage scope is `board | inventory | toolbar | any`. Query reach is separate: `board` is the origin-space Board, `inventory` and `toolbar` are their global surfaces, `any` is the origin-space Board plus both passive surfaces, and `universe` is every Board plus both passive surfaces. `universe` is not a storage scope.

A Board-relative condition requires a physical Board origin. From Inventory or Toolbar it evaluates false, including `count: 0` and ranges containing zero; it does not reinterpret passive coordinates or invent an empty Board query. This applies uniformly to action, line, Clock, and output rules. An unavailable Enable condition denies availability; an unavailable Disable condition casts no veto. Direct Board queries without a Board origin remain invalid.

Only compatible pure items stack, up to `maxStackSize`. Purity is derived from live state: an item is impure when it or an owned line carries identity-bound state such as input, a job, a queue request, or a partial unit count. An impure item has effective stack size `1`. Merge random-stream history does not restrict stacking: a surviving identity keeps its cursor, while a new identity starts its own stream.

When a Board operation first attaches state to a stacked identity, the original identity becomes quantity `1` and the pure remainder uses standard placement in the same atomic transition. Failure to place the remainder changes nothing. Generic stack/quantity operations accept only pure items.

A `limit` rule condition selects one canonical item and is true when its existing quantity across the entire Runtime reaches or exceeds its authored `maxCount`. It includes every Board, Inventory, Toolbar, stored input, delivery and committed job material, regardless of the rule origin. Future job output reservations and queued intent do not contribute; an item without `maxCount` never satisfies it. `Disable + Limit` therefore blocks a line or suppresses a drop while the target limit is reached. It uses the same rule ordering and pinned snapshot as other conditions; ordinary live-plus-reserved capacity admission remains authoritative and unchanged.

## Lines, intent, and delivery

Item production lines share one lifecycle. Each item owns zero or more `lines`; without lines or an immediate action it is passive. Production uses `maxQueueSize` (default `1`). A default line selects the click action; it does not schedule work automatically. Input filling is passive and never starts work. Each material input stores at most its authored `quantity.max`; there is no extra input capacity. Enqueue is the player-facing execution command: it appends explicit intent after validating the owner, line, rules, non-material requirements, units, output capacity, and queue capacity. Missing concrete material may wait.

A queued request is not a job. It owns no time, material, unit, or reservation. The persisted global queue retains accepted intent order. Each queue pass traverses that array in order against the latest Runtime draft and selects the earliest actionable request for each idle Board owner. A request makes progress by starting a Job or scheduling useful canonical Autofill delivery while its rules, non-material requirements, units and output limits hold. Only progress marks its owner as handled for that pass; blocked requests may be overtaken. Other owners compete for shared resources in the same global traversal order.

A blocked probe changes no Runtime state, stored inputs, units, reservations, deliveries, events or gameplay randomness. Skipping preserves the request's identity, line, relative array position and valid line-input ownership. Once actionable again, an older request wins over later requests for that owner. An already travelling delivery alone is not new progress. Active Jobs remain non-preemptive during queue dispatch; explicit forced owner removal can abort them. Stored owners cannot dispatch. Each dispatch pass admits at most one progress-producing request per owner, including the separate passes after completion or item expiry within the same fixed step. Queue reads retain accepted request order without promising execution order.

The player may clear all pending requests for one owner without affecting its active job, units, consumed material, or reservations. Clearing atomically returns unused stored input roots for the removed request lines and reverses their outbound deliveries through canonical placement; if a stored root cannot be returned, nothing is cleared.

At a fixed-step boundary, queue playback may Autofill useful concrete material through canonical deliveries while retaining the request. Delivery travel is persisted engine state with fixed-step remaining duration. A successful Autofill admission emits one `line-input:autofill-started` event with the owner, line and scheduled quantity, shared by targeted clicks and queue playback. No-op or rejected attempts emit nothing. The material becomes available only when Tick settles delivery into input storage. Renderer geometry/contact never admits material or starts work. A missing or invalid soft target returns the same leased actor, including a partial remainder, to its persisted origin.

Only after required material has settled may a later queue pass create the job and remove its request. Start re-resolves every live fact and commits input ownership, unit spending, stateful-stack isolation, output reservations, and the job atomically.

## Immediate item actions

An item may own one optional `action`, discriminated by `type`. An action and nonempty production `lines` are mutually exclusive. Action availability is determined only by its `rules`: every Enable rule must pass, any matching Disable rule vetoes activation, and no rules means available. There is no authored action enable flag. Optional `input` requirements reuse immediate-action unit admission and settlement.

The `space` action selects its authored `space`. Activation verifies the clicked identity, revision, location and current-space snapshot, then settles requirements and navigation in one transaction. Rejection or blocked depletion output changes neither units nor navigation. Actions activate on the current Board or Toolbar and reuse those origin policies; Inventory clicks exclusively release items. Unit settlement never invents a Board origin for a passive payer.

Dropping an item onto a `space` action item teleports the exact source stack to the first free compatible cell, in row-major order, on that action's authored Board. This occupied-target behavior takes precedence over input storage, merge, stack and swap without activating the portal, settling its inputs or changing the player's current space. The portal remains in place. A successful transfer emits `item:portal-transferred` for its assigned SFX; rejected drops emit no transfer event. The shared `item-drop:rejected` presentation SFX covers rejected Board, Toolbar and Inventory drops, including portal transfers; ignored drops and cancelled gestures stay silent. Direction stays source-owned: a portal dropped onto another item may still use its own authored merge, while an item dropped onto the portal never merges into it. An incompatible source scope or full destination Board rejects the drop atomically. A successful swap emits one `item:swapped` event for both items, with their identities and original locations, instead of separate placement events.

The `inventory` action opens global Inventory when activated. It is also a directional Inventory drop target: dropping another item onto it stores the exact source stack through ordinary authored scope and global Inventory capacity, while the action item remains in place. The source item's own merge rules do not override this target behavior. Inventory storage and release do not otherwise require a physical opener; Drag + I stores the held item through the same policy. Clicking an item in Inventory exclusively releases its complete stack and runtime identity; it never executes the item action or production. Release uses the first empty compatible cell on the current Board or Toolbar; `any` tries Board before Toolbar, never Inventory or an occupied stack. A failed storage or release leaves both items unchanged.

## Tick, jobs, and item lifetimes

Effect Clock is the production wall-clock source; simulation advances in canonical 100 ms fixed steps. In normal gameplay, a long elapsed interval equals the same sequence of explicit steps. Accelerated live playback instead limits each wake to one complete step and drops overdue accelerated wall-time debt under load. Session-only observation/remainder state is not persisted, and an attempted complete step is acknowledged once even when advancement fails.

Output conditions for each start, completion, and expiry use that operation's pre-operation Runtime snapshot. Earlier lifecycle results in the same Tick are visible; partial changes within the current operation are not.

Jobs persist only:

```text
durationMs
remainingMs
```

Runnable jobs decrement by one step, clamped at zero; paused jobs do not. Completions settle in stable job-ID order. Work admitted during that boundary receives no retroactive time. Players may cancel one exact active job on an interactive owner. Cancellation consumes committed material without refunds or line output, returns reservations through ordinary placement, and preserves pending intent unless owner depletion removes the owner. Failed placement rolls the cancellation back; a stale job identity is a no-op. Material expiry and cheat-only forced owner removal also use the shared abort settlement.

Items with `clock` are identity-bound and non-stackable, and may author any storage scope. A finite lifetime persists `schedule.remainingDurationMs`, initialized from `clock.durationMs`. Enabled identities present at both step boundaries age by that step in every location scope. Moving an identity between scopes neither pauses nor resets its schedule. Job output created in the current step starts at full duration.

Exhausted items expire after job completion in stable runtime-ID order, so a job completion tied with its material expiry wins. Expiry output follows ownership to the item's physical grid origin: its own Board, Inventory or Toolbar cell; its delivery lease; its input owner; or its job owner. The expiry, optional deterministic output, affected-job abort, and reservation returns commit atomically. In the default loose-kill mode, failed placement leaves the same zero-duration item in place; an affected active job stays frozen until expiry can settle. Kill-switch uses the forced-removal policy below.

## Scheduled production

`Item.clock` adds periodic admission, finite lifetime, or both to a non-stackable item. It uses the same line admission, jobs, Autofill, units, delivery and output operations as manual production. Each pulse evaluates all selected Clock lines against current line rules, builds a pool of enabled lines regardless of visibility, and draws one with probability proportional to its `clockWeight`; an admitted request retains that exact line even if the selection changes later. An empty enabled pool, unavailable admission or a full queue consumes the pulse without hidden debt or drawing again. A saved per-owner pulse sequence seeds weighted selection independently of Tick grouping and hydration. Queue capacity counts the active job plus pending requests.

Optional `clock.intervalMs` is at least 100 ms; optional `clock.durationMs` is at least 100 ms and limits active lifetime. At least one must be present. Missing duration means unlimited lifetime; missing interval means a one-shot lifetime with no production pulses and no required lines. Both timers pause only while the clock's enable/disable rules deny availability, with Disable retaining veto precedence. An empty Clock selection skips admission but still evaluates rules and ages phase and lifetime normally. There is no separate player on/off state. Sub-step phase remainder prevents rounding drift. Every location scope earns schedule time. A periodic pulse outside Board advances phase but cannot admit Board-owned production; returning to Board does not create catch-up work. Speed up targets ×20 wall-clock speed for the whole simulation, including Clock pulses, jobs, deliveries and finite lifetimes. Admission retains its normal simulation-time cadence.

Line `default` and `clock` are independent authored booleans. At most one line per owner may be Default; any number may participate in Clock, including the Default line. Each line has integer `clockWeight` (default 1, range 1–999). Editor Default selection clears only sibling Default flags; Clock flags are independent. Conflicting Default configurations are rejected. Runtime Default selection holds one ID (`null` selects none). Runtime Clock selection holds an array of IDs (empty selects none); missing overrides inherit authored markers. Changing either role leaves the other role, accepted requests, phase, pulse sequence and lifetime unchanged. Default selects the manual click action; Clock selects weighted periodic admission.

Item `ui` controls Item Detail presentation explicitly: `simple` shows only information and hides section navigation; `default` (the default) always shows Info, Lines, Queue and other sections, even without lines. Opening a default item starts on Lines regardless of active or queued work; explicit section navigation remains available.

Simple UI denies player production commands, material storage/withdrawal, queue changes and both line selections. It leaves autonomous Clock production, immediate Actions, ordinary movement and merge policies intact; neither UI mode gives the player an item-removal command. Default UI permits players to enqueue any available line independently of Clock, including with no Clock selection or while rules pause the timer. Manual and periodic requests share ordinary queue order and capacity; neither receives priority over previously accepted runnable work.

With `clock.expiryMode: "loose-kill"` (also the meaning of omission), existing production earns its step before schedule pulses are admitted; work started by a new pulse earns no retroactive time. A pulse exactly tied with the final lifetime boundary still attempts ordinary admission with no queue privilege. Lifetime then closes all new intent. Active jobs and currently startable requests may outlive the schedule under ordinary global queue order. Exhausted owners start no new Autofill and do not wait for incoming material once idle. After the dispatch pass, an exhausted idle owner discards unstartable requests, returns outstanding deliveries and stored input roots through ordinary placement, and atomically disappears with its optional `clock.onExpire` Output. Blocked expiry placement preserves the exact exhausted owner and pending state for deterministic retry; no output or material is lost or duplicated.

With `clock.expiryMode: "kill-switch"`, reaching zero lifetime suppresses the final pulse and any further queue dispatch for this owner. Jobs successfully completed at that same boundary retain their completion precedence; all remaining owner jobs and queued requests are canceled. Forced removal is a general Runtime operation, explicitly selected by Clock expiry, not a speed-up behavior. It removes the owner and consumes aborted-job inputs, then places reserved instances first, unused stored input roots second, and the normally resolved expiry Output last. The removed owner's cell is available to these returns. Consumed inputs and spent units are not refunded; canceled jobs emit no line output. Incoming deliveries follow their ordinary return path. Removing committed material also reconciles its parent job before stored inputs and expiry Output are placed.

Forced removal retains ordinary storage eligibility, stack and global quantity limits. Each placement keeps the quantity that fits; the remainder is permanently discarded. A stateful reserved or stored input root either returns with its identity and passive owned state intact or is discarded together with that state. Cancellation, removal, all placements, and all loss facts form one candidate Runtime and commit together with its events. No intermediate removal or partial placement is published. Unexpected failures abort the entire transition; they never become silent capacity loss. `job:aborted` identifies the canceled job, owner, line and cause; `item:discarded` identifies the owner, canonical item, existing runtime identity when applicable, quantity, source and reason. Every such committed fact is also retained in the `game.removal` diagnostics log, independently of the bounded on-screen history.


## Material ownership

Material input uses one exact canonical item selector and one of two modes:

- `consume`: the material stays intact while stored; start discards its passive owned subtree, moves only the inaccessible root into `job` scope, and completion destroys it permanently. Conversion is not unit depletion and emits no depletion output.
- `reserve`: start moves the same live instance into `reserved` scope. Completion relocates it from the owner's current Board origin. Pure material may normalize into ordinary stacks/identities; impure material preserves exact identity and needs one exclusive cell.

Neither mode remembers historical stack, slot, or position. Each committed root retains its material input index so live requirements remain attributable. Job-owned material is inaccessible to generic mutations. A material input closes while its line runs. Clicking a buffered material in Item Detail withdraws one piece through ordinary output placement, preserving pending queue intent; committed job material cannot be withdrawn. Clicking an empty material slot requests targeted Autofill toward its maximum through the same source selection and delivery pipeline used by queue playback. It fills only that slot, accounts for incoming claims, and creates no queue intent or job. The command rechecks an interactive Board owner, open lifetime, non-running line and zero stored quantity atomically; partial fill keeps the withdrawal action. This applies equally to consumed and reserved material. Items with a finite lifetime may enter material input and keep aging through input storage and active work.

When any committed material expires, the engine aborts that job and removes its remaining consumed roots before placing expiry output, freeing the canceled job's output reservations. It produces no line output and never refunds units spent at start. A depleted job owner settles its normal depletion lifecycle first: remove the owner and its queue, place depletion output, release its stored inputs, then return job reservations. A non-depleted owner preserves queued intent and returns every reservation from its physical grid origin. Material expiry output follows these returns; both outputs evaluate rules against the same pre-expiry Runtime snapshot. Loose-kill rolls the entire transition back if placement fails; kill-switch retains the forced-removal discard policy for depletion output and all returns. After a successful expiry pass, idle owners' queued requests are retried in global intent order against the resulting Runtime.

Cheat removal of an authored idle Board owner releases its stored input roots through canonical existing-item placement in the same transition. A loaded passive owner must return to a Board before that cheat command because no passive coordinate is reinterpreted as a Board origin. Clock expiry is the explicit exception above: it removes the owner in its current scope and returns stored roots from that physical grid origin. Any blocked release rolls the removal back.

## Units and completion

Units are an item capability available to every item: passive and manually operated resources use the same Item schema, and scheduled production adds Item.clock. A units input selects a Board item with a unit supply; it does not require a special item type.

`quantity` counts item instances in a stack; `units` is the finite supply inside each instance and can represent health, resource stock, or uses.

An item may author finite `units.amount` and optional depletion output. Missing live `remainingUnits` means the fresh full amount and remains pure. Input costs spend units from either the line owner (`self`) or the deterministic Board target of a units input (`target`). Queueing pays nothing.

Start reserves unit budget by runtime payer across the entire line, aggregates all costs per payer, and spends each payer once. Partial spending stores identity-bound unit state and isolates one stack quantity. Full idle depletion consumes one quantity in place. Idle external payers with queued work are skipped when the aggregated cost would fully deplete them. Eligible idle external payers die and emit depletion output during start; an active owner may remain at zero until its job completes or is aborted.

Completion removes the ready job and consumed roots in one candidate, keeps reserved roots live, then applies this order:

```text
remove a depleted owner and its queue
→ place optional line output
→ place optional owner-depletion output
→ release the depleted owner's stored inputs
→ relocate reserved instances
```

A non-depleted owner, its stored inputs, and pending queue remain. Any unit, placement, capacity, or return failure preserves the pre-completion state for retry. One blocked owner does not prevent independent owners from advancing.

## Output capacity and randomness

Every active job reserves the worst possible future quantity of each canonical output against `maxCount`, including deferred owner-depletion output. Fixed quantities reserve their value, ranges their maximum, chance rolls success, rolls in a selected set add, and alternative sets use the per-item maximum. Queued requests reserve nothing. Capacity checks cover the admitted line and its depletion output; produced items do not reserve output for their own future production.

An output contains one or more alternative sets. Each set evaluates its availability rules against the output origin and the pinned Runtime snapshot before selection. Available sets contribute their positive relative weights; exactly one is selected. No available set emits nothing and consumes no selection or quantity randomness; one available set needs no selection randomness. Every roll in the selected set then resolves in authored order: Guaranteed includes all its drops, while Chance shares one probability check across its entire drop group. Separate Chance groups are independent. There is no nested weighted selection or repeated draw. Individual drop rules run after set selection and chance resolution; rejected drops are discarded without replacing the set or rerolling. Quantity ranges and placement remain per drop. Reservations conservatively include every authored set regardless of its current availability.

All quantity-creating paths and hydration include active-job reservations. Completion removes its own job before placement, spending rather than double-counting its reservation. Quantities that the same completion destroys—consumed material and a depleted owner—offset output of that canonical item. Admission removes passive descendants destroyed by complete material consumption from its projected live counts, so that immediate destruction can free capacity for any output. Consumed roots and depleted owners grant future removal credit only to their own completion. Spending an external active payer's final unit updates that payer's existing job reservation, including its own consumed-material and owner-removal offsets, independently of the candidate job. Reserved material grants no removal credit, and active-job reservations use the resulting post-start state. Immediate external depletion output is live output during start, not a later reservation. Overbooking rejects the whole candidate.

Randomness derives from stable canonical identities and explicit algorithm versions, never Tick or wall time. Unchanged blocked start/completion/expiry retries therefore resolve the same rolls and placement order.

Each surviving merge source also persists a `mergeSequence` cursor (omission means zero). Every successful source merge advances it once; a rejected or interrupted transaction never advances it. Both merge output and participant depletion rolls use the incoming cursor, so repeated successful `use` actions draw fresh results even when the source returns to the same stack. Save/load and same-identity target replacement preserve the cursor. Stack normalization retains the surviving identity's cursor without combining histories.

## Placement and merge

One scope-aware placement policy serves ordinary drops, line/depletion/expiry output, reserved-instance relocation, stored-input release, and initial placement:

```text
validate live + reserved maxCount
→ apply authored scope and Board strategy
→ fill compatible pure stacks
→ spawn into empty locations
→ require the complete quantity
```

The placed item's authored scope decides every eligible destination: `board`, `inventory`, and `toolbar` stay in that exact scope, while `any` may use all three. Placement starts in the origin's scope, then falls back Board → Inventory → Toolbar from Board, Inventory → Toolbar → current Board from Inventory, or Toolbar → Inventory → current Board from Toolbar. A Board destination without a Board origin uses the current space's canonical scan order for `drop`; `random` chooses a fresh Board origin for every resolved quantity unit, including occupied cells. Each scope places stack-first against the evolving draft, Board placement is nearest-first when it has an origin, and no output falls back to another Board space. Existing pure items may normalize; impure items keep exact identity and require one empty cell. A full required scope blocks the complete owning mutation; partial placement is forbidden.

Directional merge is one canonical gameplay command. The source item owns ordered rules; the first exact target selector wins and reverse matching is never inferred. One source quantity is consumed, used, or has a unit spent through source `spend`; one Board target is kept, removed, replaced, or has a unit spent through target `spend`; and optional output uses ordinary placement. A pure replacement uses ordinary stack-first placement and retains the target identity only when it must create a new stack; an impure replacement never stacks and retains the target identity in an exclusive location. Replacing a finite-lifetime target discards its remaining lifetime and initializes the replacement through its own canonical item state. `use` returns the source through ordinary placement without spending units. Each `spend` spends one real unit from its respective participant and runs that item's standard depletion output when the last unit is spent. A depleted source returns buffered inputs from its physical Board, Inventory or Toolbar origin through ordinary placement; a blocked return rolls the whole merge back. Source action, target effect, output, return, validation, and event commit together. Same-item stacking is separate from merge.

A merge replacement may transform a target with partially spent units. When the result has units, it inherits the number already spent; a result with no units discards the old supply. A finite result with no units left after that transfer is rejected atomically. Replacement still rejects targets with owned production state such as stored inputs, active jobs or queued requests.

## Audio

`game.json.music.playlist` is the only global random Music pool. Its entries are exact Music resource IDs, each selected track is packaged, and the Game streams them through the two-slot crossfade mixer without treating other Music resources as playlist members. An empty or absent playlist produces no background Music. An optional item `music` resource ID temporarily requests its own track while its detail is open, without altering the global pool. The global track pauses with its position retained; opening another detail crossfades directly to its requested track, or returns to the paused global track when no music is requested. Closing the detail also restores that global track. Requests for the same track continue without restarting. Detail tracks begin at a fresh random position between 10–90% of their duration and crossfade to another random start after reaching the end; the global playlist retains its normal playback policy. SFX use their independent bounded voice mixer. Items with `ui: simple` suppress the job scheduling (`job:queued`) sound; the committed gameplay event remains available to other observers.

Committed lifecycle events remain composable audio facts. Expiry and full unit depletion keep their own events. When the final visible item identity vanishes and its expiry, depletion, or authored removal output places no replacement, the same transaction additionally emits `item:disappeared`; configured output that rolls nothing or is fully discarded is not a replacement. A surviving stack quantity or an actually spawned/stacked lifecycle output suppresses only this additional event. Ordinary line output and released stored inputs are not lifecycle replacements. Merge source consumption and internal consumed production material do not emit disappearance because they are inputs to another surviving or replacement result.

## New-game introduction

An installed package with nonblank `meta.introduction` shows its Markdown in a scrollable modal occupying 37.5% of viewport width and 75% of viewport height before a new game starts. Continue acknowledges it and initializes the authored world exactly once. The playable scene is not mounted before acknowledgment. While the introduction is pending, the session contains no initial items and writes no save, including during application close; elapsed reading time is drained before initial placement. Closing before Continue therefore shows the introduction again next time. A valid existing save bypasses it, and an absent or blank introduction preserves immediate startup. Hard reset removes the save and shows the introduction again. The Editor's live Board does not show this player introduction.

## Cheats, save, and presentation

Cheat availability is application preference; enabled cheat state, including Speed up, is Runtime state. A fresh Editor Board enables cheats with Default authored timing. Speed up uses the fixed shared `GameplaySpeedUpMultiplier` (20), passed by Game and Editor composition into the session and Tick. Tick requests one unchanged 100 ms simulation step every 5 ms of wall time. Each accelerated wake publishes at most one step; when computation or the host falls behind, excess accelerated wall time is discarded rather than accumulated into catch-up bursts. The next wake accounts for computation time and always yields to the host. Thus ×20 is a target under load, not a guarantee; normal-speed elapsed-time replay stays complete. Switching the option does not advance or settle gameplay by itself. The multiplier is not player-configurable; individual domain timers do not read the shared constant. Hard reset is renderer lifecycle: discard the exact Game without final save, clear only its verified save, then acquire a fresh Game. It is not an authored item command.

Serializable State contains items, deliveries, jobs, queues, current space, and gameplay cheat state—not wall-clock timestamps, Tick observation cursors, transient events, or UI state. Hydration strictly validates the current shape and invariants. Matching-major compatibility is defined only by [`VERSION.md`](VERSION.md).

[`src/game-event`](src/game-event) owns strict transient facts projected from already-applied transition results. Event-only commits do not mutate Runtime. Transition subscribers observe current-plus-tail, while event subscribers discard that current replay. Slow presentation callbacks cannot delay Runtime, Tick, save, or another subscriber. A failing callback cannot roll back or stall its triggering commit or peer delivery; afterward, the existing fatal session fail-stop applies.

Presentation may trail canonical Runtime and may redirect, shorten, collapse, or skip choreography. It never determines readiness, validity, placement, queue/job state, Tick progress, save, or event publication; a new subscriber never receives old events merely because another surface is still animating them.

Do not add queue reordering, wall-clock job timestamps, reverse reservation history, partial output, passive-storage production, or gameplay truth reconstructed from UI/events without an explicit new product design.

Production artwork uses the same activity effect for every running job owner. Every owner with an active job uses the same occupied opacity, including jobs waiting for completion placement; passive items retain their normal opacity.
