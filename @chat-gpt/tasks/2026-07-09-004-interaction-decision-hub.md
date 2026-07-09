# 2026-07-09-004 Interaction decision hub

## Problem
`src/play/interaction/resolveItemToBoardItemInteractionPlan.ts` is no longer a wrapper jungle, but it is now a concentrated hotspot with too many interaction families in one decision tree.

## Goal
Simplify the internal routing of interaction planning without re-fragmenting the chain into more helper files.

## Current hotspot
- `src/play/interaction/resolveItemToBoardItemInteractionPlan.ts`

## Target shape
- fewer mechanical branches
- interaction families grouped clearly inside the file
- no new translator files

## Guardrails
- keep merge vs stack precedence unchanged
- preserve gameplay semantics and tests
- prefer internal simplification over file splitting

## Done when
- the file is easier to read by interaction family
- at least one redundant branch path or duplicated guard disappears


## Progress
- 2026-07-09: collapsed mechanical action/source-ref translators into one commit helper (`readItemToBoardItemInteractionCommit`) and rewrote the resolver as ordered interaction-family readers instead of a big facts bag + ts-pattern dispatch.
- Remaining focus: if the file stays the main hotspot, reduce local branching inside producer/craft family checks without re-fragmenting into new files.

- 2026-07-09: introduced a readable compiled `ItemInteractionProfile` and `ItemSpecialInteractionKindSchema` so merge/stack/input routing can pre-check static capabilities without bitmasks or callsite branching. Board tap special-item handling now reads the shared special interaction kind instead of open-coded item-id checks.
