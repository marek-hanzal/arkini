# Runtime purity state-attachment closeout

Date: 2026-07-14

The deep review of HEAD `e3991d33` correctly found that purity was enforced only while stacking or changing quantity, not while attaching the first identity-bound state to a stack.

## Final invariant

```text
pure stack
→ quantities are interchangeable

operation attaches buffered input, an active job, a queued request, or future item-owned state
→ build that state inside one immutable candidate
→ preserve the original board identity at quantity 1
→ standard-place the pure remainder
→ validate and commit once

impure item
→ effective max stack size 1
```

Inventory remains passive storage. New identity-bound state cannot be attached while the owner is in inventory. Existing state moves with the owner and pauses there according to its lifecycle.

## Implementation

- `isolateStatefulOwnerFx` owns the one general board-owner isolation operation.
- `storeInputMaterialFx` applies the input transfer first, allowing a fully consumed source cell to become available, then isolates the now-stateful owner.
- `startLineRuntimeFx` creates the active job and applies its input plan, performs the general max-count reservation check, then isolates the now-stateful owner.
- The craft-only start split helper was removed.
- `readItemEffectiveMaxStackSizeFx` resolves configured stack size for pure items and `1` for impure items.
- The existing `item:stack-size` runtime issue reports that effective limit; the craft-specific job quantity issue was removed.
- Failed remainder placement rejects the complete command with no runtime or event publication.

The same state-attachment rule must be used when future charges, temporary lifetime, deposit capacity, memory snapshots, or other identity-bound state are introduced.
