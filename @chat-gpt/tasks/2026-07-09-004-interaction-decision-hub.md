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
