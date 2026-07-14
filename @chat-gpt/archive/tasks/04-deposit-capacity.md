# 04 — Item charges and deposit inputs

**Status:** Done

## Final model

Deposit capacity was generalized into item-owned charges rather than copied as a deposit-only subsystem.

```text
item.charges
├── amount
└── output?

input.charges
├── cost
└── from: self | target
```

- Any item type may own charges.
- An item without charges is persistent.
- A charged item dies when one instance reaches zero.
- Missing live `remainingCharges` means the fresh authored amount and remains pure.
- A partial spend stores state and isolates one board instance.
- Full idle depletion consumes one quantity in place.
- A deposit input deterministically resolves one matching board target and must charge that target.
- Costs from all inputs are reserved and aggregated by payer ID before mutation.
- Queue requests pay nothing until actual dispatch.

## Atomic lifecycle

At line start:

```text
resolve material and charge plans against one runtime
→ create the candidate job
→ apply material consume/reserve
→ aggregate and spend charges
→ resolve idle depletion output immediately
→ isolate surviving stateful payers
→ assert future maxCount
→ validate and commit once
```

Idle full depletions run before surviving payers so the same command may use capacity it frees. Any failure rolls back material changes, charge spends, item removal, output, isolation, job creation, and events.

A payer with an active job may remain temporarily at zero charges. Completion removes that depleted owner and queue, resolves `line.output`, then optional `charges.output`, releases owner inputs, and returns reservations atomically.

## Max-count and randomness

- Active jobs reserve worst-case `line.output` and deferred owner-depletion output.
- A dying owner offsets output of its own canonical item.
- Immediate external depletion output is placed during start; the final start max-count assertion then validates live immediate outputs together with every active-job reservation.
- Deferred depletion randomness derives from job identity plus depleted item identity.
- Immediate depletion randomness derives from stable unchanged owner/line/payer/spend facts.

## Runtime invariants

Runtime validation rejects:

- stored charges on an item without authored charges;
- remaining charges above the authored amount;
- redundant stored full charge state;
- zero-charge idle items without an active owner job;
- any stateful item stack above effective quantity `1`.

## Validation

Game validation rejects:

- deposit inputs without a target charge cost;
- self-charging deposit inputs;
- target charging on non-deposit inputs;
- self costs on owners without charges;
- cumulative self costs above the authored amount;
- target selectors that cannot match an item able to pay the cost;
- positive material capacity on craft, blueprint, or stash lines.

## Permanent tests

Coverage includes:

- limited producer partial and final use;
- line and depletion outputs;
- partial charged-stack isolation;
- full stack-quantity depletion without relocation;
- aggregate self and shared-target costs;
- deterministic fallback to another payable target;
- blocked depletion-output rollback;
- capacity freed by an idle depletion before another payer isolation;
- save/restore of partial charge state;
- invalid runtime charge states;
- authored deposit flow and validation.

## Historical cleanup

The current runtime supersedes the behavior under `src/v0/capacity` and deposit-specific producer paths. Presentation requirements remain owned by tasks 10, 13, and 14; physical historical deletion remains task 17 cleanup because the old tree is still cross-linked.
