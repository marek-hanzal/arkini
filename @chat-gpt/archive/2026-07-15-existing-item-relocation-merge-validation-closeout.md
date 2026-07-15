# Existing-item relocation and merge validation closeout

Baseline: `81fc62f8`

## Closed findings

- Buffered-input release no longer destroys and rematerializes live runtime roots.
- `releaseOwnerInputsFx` detaches only the board owner and sends every direct buffered root through `placeRuntimeItemFx`.
- Pure roots may normalize into ordinary stacks and identities.
- Impure roots preserve runtime ID, revisioned state, charges, and their passive owned subtree.
- Standard placement remains board-first from one owner origin with authored-scope inventory fallback.
- A loaded owner in passive inventory must return to the board before removal; inventory coordinates are never treated as a board origin.
- Merge validation rejects target selectors that cannot match a board-capable item and replacement results that cannot legally remain on the board.
- Missing exact target/result references remain owned exclusively by `config:missing-reference` diagnostics.

## Canonical placement rule

```text
new material quantity
→ material placement pipeline

existing live item that survives
→ placeRuntimeItemFx

pure existing item
→ may normalize into stacks/new identities

impure existing item
→ preserve exact identity and state graph
→ one exclusive destination cell
```

Do not add lifecycle-specific return/release placement helpers. Extend the canonical placement domain when a real new placement capability appears.

## Permanent regression coverage

- public owner removal preserves partial charges and nested passive ownership;
- pure buffered roots still normalize into existing stacks;
- impure roots use board-first inventory fallback without identity loss;
- blocked multi-root relocation rolls back the complete removal;
- inventory owner removal with buffered state is rejected atomically;
- merge target removal preserves buffered impure identity/state;
- depleted-owner completion preserves impure buffered state after line output claims priority;
- exact and tag merge targets must be board-reachable;
- replacement results must be board-capable;
- missing references do not produce duplicate merge diagnostics.

## Verification

- format: passed;
- dependency graph: passed;
- source and test typecheck: passed;
- `game:validate game/arkini`: passed;
- all six Vitest shards passed;
- shard 2 printed a complete green summary but required timeout after summary because of the known Vitest shutdown issue.
