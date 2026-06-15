# Complete command-event animation planner cleanup

Status: TODO

## Goal

Make command visual events the main animation truth and remove remaining ad-hoc animation staging paths.

## Current state

Completed at baseline:

- Commands return `visualEvents`.
- `src/animation/stageCommandVisualEvents.ts` maps game command events into generic actor motion entries.
- TileEngine remains standalone and uses generic transition kinds only.
- Activation and inventory placement no longer use the oldest bespoke staging helpers.

Missing:

- complete event coverage for merge, feed, craft, upgrade, blocked commands, stash depletion, and failed placement
- clearer event queue ownership
- stronger separation between visual event planning and DOM anchor resolving
- removal of leftover old motion/drag staging helpers that are no longer needed

## Proposed files/areas

- `src/animation/stageCommandVisualEvents.ts`
- `src/animation/logic/commandVisualEventStageEntries.ts`
- `src/animation/logic/locationVisualRect.ts`
- `src/animation/logic/locationVisualActorKey.ts`
- `src/play/logic/visualItemMotionMachine.ts` or replacement if it still exists
- `src/drag/logic/*` for stale animation paths

## Acceptance

- Move, swap, merge, feed, activation output, inventory placement, craft claim, and depletion all stage from command visual events where animation is needed.
- Remaining non-event animation paths are justified in comments or removed.
- TileEngine still imports no Arkini-specific domains.
- Actor identity remains stable across move/swap/state updates.
- Typecheck and build pass.

## Watchouts

- Do not put `item`, `activation`, `board`, `inventory`, or `command` imports inside `src/tile-engine`.
- Do not make command events DOM-specific. DOM rects belong in app adapters.
