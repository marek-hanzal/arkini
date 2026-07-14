# 05 — Directional merge execution

**Status:** Queued

## Goal

Implement the authored directional source/target interaction as an atomic engine command. This is gameplay merge, not stack placement.

## Current engine facts

- directional merge schemas and semantic validation exist;
- source action is `use` or `consume`;
- target effect is `keep`, `remove`, or `replace`;
- optional output exists;
- move, swap, remove, replace-oriented placement, output rolls, and revision guards exist;
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

## Historical cleanup on closeout

Remove historical merge runtime/action code after tasks 11 and 14 capture interaction feedback and animation intent.
