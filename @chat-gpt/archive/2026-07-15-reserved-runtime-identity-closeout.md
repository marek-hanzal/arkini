# Reserved runtime identity closeout

## Context

The charges/queue follow-up review reproduced two lifecycle asymmetries:

- reserved impure material was reconstructed from canonical item ID and silently lost runtime identity/state;
- persisted consumed roots could retain owned state and become permanently uncompletable.

The pure-only reservation workaround was rejected in favor of preserving the actual live runtime instance.

## Canonical contracts

### Reserve

```text
input item
→ authoritative start moves the same live instance to scope: reserved
→ identity, charges, revisioned state, and passive owned subtree stay attached
→ completion relocates that same instance from the current line-owner board origin
```

No original slot, stack, position, or return metadata is stored.

Existing-item placement is generic:

```text
pure
→ may normalize through ordinary stack/spawn placement
→ disposable runtime identity may disappear

impure
→ preserves exact identity and complete state graph
→ cannot stack or split
→ requires one exclusive grid cell
```

### Consume

```text
input item
→ authoritative start discards passive owned subtree
→ only consumed root enters scope: job
→ completion discards the root
```

Hydration rejects a consumed root that still owns input descendants, active work, committed job material, or queued intent.

### No-cancel boundary

The passive-state discard primitive may delete passive input descendants and queued intents. It must fail on active jobs or committed job material and never act as a hidden cancellation API.

### External target charge validation

Offline validation deliberately proves only one aggregate case:

```text
exact-item target selectors in one line
→ sum authored costs by canonical payer
→ compare with charges.amount × finite maxCount
```

Broader selector/resource-flow feasibility remains outside this lightweight validator.

## Runtime diagnostics

The old reservation-only orphan name was replaced with the truthful generic material diagnostic:

```text
job:material-orphan
```

Consumed roots with remaining owned state report:

```text
job:consumed-material-state
```

## Verification expectations

- partially charged reservations return with the same ID and remaining charges;
- buffered subtrees retain owner identity across reservation and completion;
- pure reservations may merge into an existing stack;
- impure return blockage rolls back the entire completion;
- destructive consume cannot cancel committed work;
- hydration accepts only the canonical empty consumed-root shape;
- exact aggregate target-charge impossibilities fail game validation.
