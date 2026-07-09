# 2026-07-09-001 Drop interaction chain reduction

## Problem
Board and inventory drops still travel through too many translation steps for the same user intent.
The current chain mixes:
- drop routing
- interaction planning
- plan -> game action translation
- runtime commit wiring
- feedback / animation wiring

This makes simple interactions mentally expensive and adds code volume through mechanical wrappers.

## Current hotspots
- `src/play/drop/resolveDrop.ts`
- `src/play/drop/resolveBoardCellDrop.ts`
- `src/play/drop/resolveBoardCellDropAction.ts`
- `src/play/drop/resolveInventoryCellDrop.ts`
- `src/play/drop/resolveInventoryCellDropAction.ts`
- `src/play/drop/resolveBoardItemInteractionPlanDropAction.ts`
- `src/play/interaction/resolveDropIntent.ts`
- `src/play/interaction/resolveItemToBoardItemInteractionPlan.ts`
- `src/play/interaction/createGameActionFromItemToBoardItemInteractionPlan.ts`

## Goal
Shorten the call chain so that board/inventory drop resolution produces final runtime-ready outcomes with fewer intermediate representations.

## Target shape
Prefer one dominant drop resolution path:
- route source/target
- resolve final drop operation
- commit runtime action

Reduce or remove pure translation layers when they do not add domain meaning.

## Guardrails
- keep gameplay semantics unchanged
- keep tests green
- do not reorganize folders in this task
- reduce helper count only when the call chain becomes shorter and clearer

## Done when
- at least one representation layer disappears or becomes internal-only
- board/inventory drop call chain is measurably shorter
- thin translation files are deleted or inlined
