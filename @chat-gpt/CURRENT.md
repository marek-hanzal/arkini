# Current project memory

This file contains durable non-obvious decisions and the exact continuation pointer. Root documentation owns the full architecture and code contracts.

## Current implementation task

**Task 08 — Multi-space board runtime**

Status: **In progress**

Read:

1. `tasks/README.md`;
2. `tasks/08-multi-space-board-runtime.md`;
3. the multi-space rows in `tasks/COVERAGE.md`;
4. current board-location, placement, occupancy, query, Tick, save, and command code.

Next action:

> Add mandatory board `space` and persistent root `currentSpace`, then make every spatial engine path strictly space-local while keeping inventory global and all spaces simulated together.

## Absolute code rules

- Named project operations are Effect programs and use `*Fx` without “pure helper” exceptions.
- Every exact identifier uses `IdSchema`; never create domain-specific ID schema aliases.
- One concept per file; no barrels, helper piles, or generic junk-drawer domains.
- Production writes enter through `modifyRuntimeFx` and build immutable validated candidates.
- The engine is standalone; UI is a thin presentation adapter.
- Do not change a configuration or runtime schema without first surfacing and agreeing on the exact need.

## Runtime and session

- One canonical committed transition owns runtime plus transient events.
- Mutation planning is serialized and interruptible.
- STM owns accepted commit and subscription registration.
- Runtime callbacks, event callbacks, save reporting, and Tick reporting are failure-isolated.
- Duplicate saves are acceptable.
- UI animation intentionally lags runtime and may be redirected by later events.
- Item revision is a runtime-only stale-intent token. Saves omit it and hydration creates fresh revisions for the new session.
- Jobs and queued requests are not revisioned because commands never target a previously observed mutable job/request shape.

## Runtime session speed

- `runtime.session.speedMode` is the single canonical live-session truth: `normal` or `accelerated`.
- Runtime session state is engine-visible but intentionally absent from `StateSchema`; hydration and a new session always start in `normal`.
- `toggleSpeedModeFx()` has no item dependency. A speed-cheat item is only a user-facing control and asset projection, never an authorization token or source of truth.
- Normal mode feeds newly observed wall time into Tick at `1×`; accelerated mode uses `30×`. Both use the same 200 ms fixed-step engine.
- Toggling first folds elapsed wall time under the old mode, then changes the root state. Pending normal time is never accelerated retroactively.
- Explicit `runTickRuntimeByFx` input is simulation time and never receives the speed multiplier.


## Multi-space board runtime

- Board memory is rejected. The world uses multiple isolated board spaces plus one universe-wide passive inventory.
- Every board location has mandatory `space`; no default, optional field, or legacy fallback exists. A board cell is `space + x + y`.
- `runtime.currentSpace` is persistent root navigation state and is saved/restored. It is not part of runtime-only `session`.
- `currentSpace` controls presentation and explicit inventory-to-board destination only. Every space continues to Tick, dispatch, complete, spend, and expire.
- Every spatial operation is local to one space. Placement may fall back to inventory according to item scope but never to another board space.
- Direct board-to-board cross-space movement, swap, merge, output, and placement do not exist. Inventory is the only cross-space bridge.
- `setCurrentSpaceFx({ space })` is a root command with no item dependency or unlock policy. Jump/Home items are future UI representations only.

## Tick, jobs, queue, and completion

- Fixed simulation step: 200 ms; production time source: Effect Clock.
- Jobs store only `durationMs` and `remainingMs`; one active job per owner.
- Temporary items store authored `durationMs` plus persisted `remainingDurationMs`. Every identity present at a step boundary loses one fixed step; identities created during that step begin at full duration and first advance on the next step.
- Ready temporary items expire after job completions in stable runtime-ID order. Expiry removes the item first, then resolves optional output from the released board origin through one deterministic output/placement stream. Expected capacity failure leaves the same item at `remainingDurationMs: 0` for retry.
- Filling inputs never starts work; starting is explicit.
- Inventory is passive storage and a hard pause. No new identity-bound state attaches or spends there.
- Started jobs cannot be cancelled; queued requests are FIFO and reserve or pay nothing until dispatch. A blocked head remains until fresh runtime makes it runnable or the player explicitly clears the owner's whole pending queue.
- `clearItemJobQueueFx({ ownerItemId })` removes every current pending request for that owner, does not target request or item revisions, and never touches active work or resources.
- Producer, craft, blueprint, and stash keep separate item schemas but use one `LineSchema`, optional `line.output`, and one generic completion path.
- Item type never decides lifetime. An item without charges persists; an item with charges dies when one instance reaches zero.
- Completion removes consumed roots and the ready job in one candidate, removes a depleted owner before line output, emits optional depletion output second, releases depleted-owner inputs, then relocates the same live reserved instances. Any failure rolls back the entire candidate.
- Active jobs reserve worst-case `line.output` plus deferred depleted-owner output against `maxCount`; dying owners and consumed job materials offset output of their own canonical items. Runtime hydration validates the same live-plus-reserved capacity used by commands.

## Charges, inputs, purity, and isolation

- Item authoring uses `charges: { amount, output? }`; live `remainingCharges` is stored only after a spend changes the full amount.
- Input authoring uses `charges: { cost, from: "self" | "target" }`. Target charging is valid only for deposit inputs, which deterministically resolve one sufficiently charged board-capable payer. `deposit` is an external-payer interaction kind, not a target item category. Validation also rejects the deliberately narrow provably impossible case where exact-item target costs exceed `charges.amount × finite maxCount`.
- Charge costs are reserved across line input resolution, aggregated by runtime payer ID, and spent once inside the start candidate.
- Idle full depletions resolve before surviving stateful payers so capacity freed by the command may satisfy later isolation.
- A fresh charged stack is pure. A partial spend stores state, preserves the original board identity at quantity `1`, and standard-places the pure remainder. Full idle depletion consumes one quantity in place.
- Material selectors describe their complete accepted candidate set. Every matched canonical item must be eligible for material-input storage; temporary items are board-bound and therefore rejected offline and by the authoritative store planner.
- A zero-capacity material input is closed during its active job; positive capacity stays open storage. Game validation permits positive capacity only on producer-owned lines.
- Pure items use configured `maxStackSize`; impure items have effective stack size `1`.
- Temporary lifetime is identity-bound runtime state, so every temporary item is impure even at full authored duration.

## Placement, reservations, and removal

- Output board placement is only `drop` or `random`; inventory fallback follows item scope. `random` chooses one origin from every board cell, including occupied cells, then runs the normal stack-first nearest placement for the complete drop without rerolling. There is no output replacement lifecycle.
- `scope: "reserved"` retains the same live reserved runtime instance, revisioned state, and passive owned subtree for one active job. It remembers no historical stack, slot, or position. Completion relocates that same instance from the current board position of the line owner.
- `placeRuntimeItemFx` is the sole canonical relocation entry point for any existing live item that survives an operation. Pure items may normalize into ordinary stacks and new identities through standard drop placement. Impure items preserve their exact identity, state, and passive owned subtree, require one exclusive grid cell, and use the same scope, origin, nearest-first, and inventory-fallback policy. Never add lifecycle-specific placement paths.
- `scope: "job"` means consumed root only. Consume discards the passive owned subtree at actual start; hydration requires the committed root to own no remaining subtree, work, or queue, and completion discards the root without return or depletion output.
- Generic mutations reject both consumed and reserved job-owned items. The passive-state discard primitive fails rather than silently deleting active jobs or committed job material.
- Shared identity removal deletes the owner and queue; full public removal additionally releases buffered roots through `placeRuntimeItemFx` from the board owner origin. A loaded owner in passive inventory must return to the board before removal; inventory coordinates are never used as a board origin.
- Completion and depletion use the same atomic primitives without nesting public write commands.


## Directional gameplay merge

- `mergeItemsFx` is the sole canonical gameplay-merge write. UI passes revised source and target identities only; source-owned authored rules decide behavior.
- Source may be board or inventory; target must be board. The first authored matching rule wins and reverse rules are never inferred.
- Exactly one source quantity participates. `consume` permanently converts it; `use` requires a pure idle source and standard-places it around the target after the target effect.
- `keep` leaves target state untouched. `remove` removes one idle target quantity through standard owner removal. `replace` preserves target identity/location but requires one pure idle quantity and recreates canonical initial runtime state through `createRuntimeItemFx`.
- Source action, target effect, source return, optional output, candidate validation, and `item:merged` event are atomic. Blocked retries preserve deterministic output rolls from stable source/target/rule facts.
- Game validation requires merge target selectors to match at least one board-capable canonical item, replacement results to allow board presence, and exact self-target rules with `maxCount: 1` to be rejected as identity-impossible. Gameplay merge is not identical-item stack placement. Historical merge runtime is superseded; only feedback and animation intent remain for tasks 11 and 14.

## Randomness

- Completion randomness derives from stable job identity plus explicit algorithm versions.
- Immediate depletion randomness derives from stable unchanged start/payer facts.
- Temporary expiry randomness derives from stable temporary runtime identity and covers both output resolution and random placement origin.
- Tick time and wall clock are not seed inputs.
- Blocked retries and restored jobs preserve the same random result while canonical inputs remain unchanged.

## Configuration

- Authoring uses recursive JSON fragments and explicit PNG resources.
- Compiler, validator, tests, and packer share one completed-config compiler.
- Duplicate providers and IDs are diagnostics; later files never overwrite silently.
- Blueprint assets are explicit standard assets. No target, output, or visual is inferred from item type or file name.

## Migration policy

- Historical source is a behavioral oracle, never an architectural donor.
- Follow the numbered queue in `tasks/README.md`.
- Update `tasks/COVERAGE.md` after every completed slice.
- Do not repeatedly inspect areas marked **Superseded**, **Rejected**, **Archive-ready**, or **Removed** unless a current task names a concrete unresolved behavior.
