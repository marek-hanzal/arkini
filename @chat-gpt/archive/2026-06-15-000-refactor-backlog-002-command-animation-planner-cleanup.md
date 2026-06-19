# Complete command-event animation planner cleanup

Status: DONE

## Goal

Make command visual events the main animation truth and remove remaining ad-hoc animation staging paths.

## Completed

- Drag/drop accepted commits now stage animations from returned command visual events instead of bespoke `DropPlan.animations`.
- `usePlayDraggableControl` runs commands with `invalidateOnSuccess: false`, stages `result.visualEvents`, and only then invalidates the command targets.
- Removed accepted-drop animation plumbing:
  - `src/drag/DraggableAnimation.ts`
  - `src/drag/logic/playAnimations.ts`
  - `src/drag/logic/resolveAnimation.ts`
  - `DropPlan.animations`
  - `DropPlan.animationTiming`
- Kept reject/failed return animation in the drag layer because it is interaction physics, not a game command event.
- Expanded `commandVisualEventStageEntries` coverage for:
  - move
  - swap
  - merge
  - feed
  - consume
  - spawn
  - activation pulse/depletion
  - inventory stacking
  - craft start/claim
- Changed board/inventory location rect resolution to prefer explicit location anchors before actor anchors, so optimistic updates do not destroy the source rect.
- TileEngine remains standalone. Game-specific command event planning stays in `src/animation`.

## Acceptance

- [x] Move, swap, merge, feed, activation output, inventory placement, craft claim, and depletion all stage from command visual events where animation is needed.
- [x] Remaining non-event animation paths are justified in comments or kept only for reject/fail drag return.
- [x] TileEngine still imports no Arkini-specific domains.
- [x] Actor identity remains stable across move/swap/state updates.
- [x] Typecheck and build pass.

## Watchouts

- Do not put `item`, `activation`, `board`, `inventory`, or `command` imports inside `src/tile-engine`.
- Do not make command events DOM-specific. DOM rects belong in app adapters.
- Do not reintroduce accepted-drop `DropPlan.animations`; accepted game changes should animate from command visual events.
