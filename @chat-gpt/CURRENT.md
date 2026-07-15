# Current project memory

This file contains durable non-obvious decisions and the exact continuation pointer. Root documentation owns the full architecture and code contracts.

## Current implementation task

**Task 06 — Temporary item lifetime**

Status: **Ready**

Read:

1. `tasks/README.md`;
2. `tasks/06-temporary-lifetime.md`;
3. the temporary-lifetime rows in `tasks/COVERAGE.md`;
4. current Tick, output, placement, item-state, hydration, and event code;
5. only the historical expiry files named by task 06.

Next action:

> Decide and implement the smallest canonical fixed-step lifetime representation for temporary board items, including exact creation boundary, deterministic Tick progression, save/restore, atomic expiry output, blocked-output retry policy, stable completion order, and one semantic expiry event without reviving timestamps or an active-effect subsystem.

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

## Tick, jobs, queue, and completion

- Fixed simulation step: 200 ms; production time source: Effect Clock.
- Jobs store only `durationMs` and `remainingMs`; one active job per owner.
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
- A zero-capacity material input is closed during its active job; positive capacity stays open storage. Game validation permits positive capacity only on producer-owned lines.
- Pure items use configured `maxStackSize`; impure items have effective stack size `1`.

## Placement, reservations, and removal

- Output board placement is only `drop` or `random`; inventory fallback follows item scope. `random` chooses one origin from every board cell, including occupied cells, then runs the normal stack-first nearest placement for the complete drop without rerolling. There is no output replacement lifecycle.
- `scope: "reserved"` retains the same live reserved runtime instance, revisioned state, and passive owned subtree for one active job. It remembers no historical stack, slot, or position. Completion relocates that same instance from the current board position of the line owner.
- Existing-item placement is the canonical relocation tool. Pure items may normalize into ordinary stacks and new identities through standard drop placement. Impure items preserve their exact identity and state, require one exclusive grid cell, and use the same scope, origin, nearest-first, and inventory-fallback policy.
- `scope: "job"` means consumed root only. Consume discards the passive owned subtree at actual start; hydration requires the committed root to own no remaining subtree, work, or queue, and completion discards the root without return or depletion output.
- Generic mutations reject both consumed and reserved job-owned items. The passive-state discard primitive fails rather than silently deleting active jobs or committed job material.
- Shared identity removal deletes the owner and queue; full public removal additionally releases buffered inputs.
- Completion and depletion use the same atomic primitives without nesting public write commands.


## Directional gameplay merge

- `mergeItemsFx` is the sole canonical gameplay-merge write. UI passes revised source and target identities only; source-owned authored rules decide behavior.
- Source may be board or inventory; target must be board. The first authored matching rule wins and reverse rules are never inferred.
- Exactly one source quantity participates. `consume` permanently converts it; `use` requires a pure idle source and standard-places it around the target after the target effect.
- `keep` leaves target state untouched. `remove` removes one idle target quantity through standard owner removal. `replace` preserves target identity/location but requires one pure idle quantity and resets item-specific state to the replacement definition.
- Source action, target effect, source return, optional output, candidate validation, and `item:merged` event are atomic. Blocked retries preserve deterministic output rolls from stable source/target/rule facts.
- Gameplay merge is not identical-item stack placement. Historical merge runtime is superseded; only feedback and animation intent remain for tasks 11 and 14.

## Randomness

- Completion randomness derives from stable job identity plus explicit algorithm versions.
- Immediate depletion randomness derives from stable unchanged start/payer facts.
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
