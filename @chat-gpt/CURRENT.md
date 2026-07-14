# Current project memory

This file contains durable non-obvious decisions and the exact continuation pointer. Root documentation owns the full architecture and code contracts.

## Current implementation task

**Task 04 — Deposit capacity and inputs**

Status: **Ready**

Read:

1. `tasks/README.md`;
2. `tasks/04-deposit-capacity.md`;
3. the deposit/capacity rows in `tasks/COVERAGE.md`;
4. current input, job start, purity, runtime item state, placement, removal, output, Tick, and persistence code;
5. only the historical files named by task 04.

Next action:

> Design finite deposit capacity as item-owned runtime state. Decide the exact reservation/spend boundary, deterministic multi-deposit selection, whether capacity may combine, move/removal guards, and depletion lifecycle before changing schemas or runtime state.

Do not recreate a parallel capacity map or preserve historical location references. Deposit state must participate in item purity and stateful-owner isolation.

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

## Tick, jobs, queue, and completion

- Fixed simulation step: 200 ms; production time source: Effect Clock.
- Jobs store only `durationMs` and `remainingMs`; one active job per owner.
- Filling inputs never starts work; starting is explicit.
- Inventory is passive storage and a hard pause. No new identity-bound state attaches there.
- Started jobs cannot be cancelled; queued requests are FIFO and reserve nothing until dispatch.
- Producer, craft, blueprint, and stash keep separate item schemas but use one `LineSchema`, optional `line.output`, and one completion lifecycle.
- Every line-owning item declares `afterCompletion: "keep" | "remove"`. Item type does not decide output interpretation or owner survival.
- Completion respects every authored placement. `replace` is invalid for a keep owner, and any possible resolved result may contain at most one replace drop.
- A remove owner loses its identity and queue. Output claims capacity before buffered inputs and reservations return. Any failure rolls back the entire completion.
- Active jobs reserve worst-case future output against `maxCount`; removing owners offset output of their own canonical item by the live quantity that disappears.

## Inputs, purity, and isolation

- Runtime purity is derived, never stored. Line input/job/queue state makes a line non-pure; item purity composes every owned line and item-owned state.
- Pure items use configured `maxStackSize`; impure items have effective stack size `1`.
- Any write that would attach identity-bound state to quantity greater than `1` must preserve the original board identity at quantity `1` and standard-place the pure remainder in the same candidate.
- Input storage and generic line start share that isolation path. Failed remainder placement publishes no state or events.
- A zero-capacity input is closed during its active job; positive capacity stays open storage.
- One schema grammar allows material capacity, but game validation permits positive capacity only on producer-owned lines. Craft, blueprint, and stash lines must author zero.

## Reservations and removal

- Reserved material always returns through standard placement and retains no historical instance, stack, slot, or position.
- Generic mutations reject job-scoped items.
- Shared identity removal deletes the owner and queue; full public removal additionally releases buffered inputs.
- Completion detaches its active job before using the shared identity-removal primitive.

## Randomness

- Completion randomness derives from stable job identity plus explicit algorithm version.
- Tick time, wall clock, and job revision are not seed inputs.
- Blocked retries and restored jobs preserve the same random result.

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
