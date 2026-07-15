# 05 — Directional merge execution

**Status:** Done

## Accepted implementation contract

- source is one concrete board or inventory item; target is one concrete board item;
- both revisions protect the player-selected identities;
- the first source-owned authored rule matching the target wins;
- one source quantity participates;
- `consume` permanently converts that quantity and discards idle owned passive state;
- `use` requires a pure idle source, detaches one quantity, applies the target effect, then returns that quantity through standard drop placement around the target;
- `keep` preserves the target; `remove` removes one target quantity through standard owner removal; `replace` preserves target identity/location but requires an idle pure quantity-one target;
- optional output resolves after source return and uses standard output placement around the original target position;
- target-inventory, active/queued participants, implicit reverse rules, and identical-item stack placement are outside this command;
- one `item:merged` transient event records the accepted semantic merge;
- merge randomness derives only from stable source/target facts plus an explicit algorithm version.

## Goal

Implement the authored directional source/target interaction as an atomic engine command. This is gameplay merge, not stack placement.

## Current engine facts

- directional merge schemas and semantic validation exist;
- source action is `use` or `consume`;
- target effect is `keep`, `remove`, or `replace`;
- optional output exists;
- move, swap, removal, ordinary output placement, output rolls, and revision guards exist;
- merge target `replace` is a merge effect, not an output placement strategy;
- no public merge execution command exists.

## Historical oracle

- `src/v0/merge/`;
- item-to-item interaction planning under `src/v0/play/interaction/`;
- drop feedback under `src/v0/board/drop/` and `src/v0/play/drop/`;
- merge visual/audio plans under `src/v0/play/game-engine-visual/` and `src/v0/audio/`.

## Do not port

- previous save mutation style;
- UI deciding which merge rule applies;
- generic drop result objects as gameplay authority;
- conflation of identical-item stacking with authored merge.

## Intended vertical slice

```text
source + target + caller revisions
→ resolve directional rule from source definition
→ validate live locations and ownership
→ plan source action + target effect + optional output
→ apply atomically
→ validate runtime
→ commit merge events
```

## Acceptance criteria

- rule selection is directional and engine-owned;
- source and target revisions protect player-selected entities;
- every action/effect combination is explicit;
- optional output is all-or-nothing with source/target changes;
- `use` returns through the accepted current rule, not historical origin metadata;
- same-item stack behavior remains separate;
- no UI projection becomes authoritative.

## Required tests

- all source-action/target-effect combinations;
- no matching rule;
- stale source/target revision;
- job-scoped item rejection;
- blocked optional output rollback;
- deterministic output retry;
- board/inventory location combinations allowed by product rules;
- flow test matching representative historical tools/resources.

## Closeout

Implemented as the canonical `mergeItemsFx` command with:

- revised source and target identities;
- source-owned first-match rule resolution;
- all six action/effect combinations;
- pure standard-placement return for `use`;
- generic removal and constrained identity-preserving replacement;
- deterministic optional output and full candidate rollback;
- one committed `item:merged` event;
- focused contract, lifecycle, atomicity, event, and authored-game flow tests.

Runtime execution no longer needs the historical merge implementation. Keep the historical tree only as a presentation oracle for tasks 11 and 14, then remove it there.

## Historical cleanup on closeout

Remove historical merge runtime/action code after tasks 11 and 14 capture interaction feedback and animation intent.
