# Fix TileEngine DnD motion handoff

Status: DONE
Priority: CRITICAL

## Goal

Fix the reported DnD regression where the interactive layer is effectively unusable:

- board item drops on empty cells snap back instead of committing,
- merge drops do not commit reliably,
- held actors do not feel alive while moving,
- grabbing an actor by a corner makes pointer targeting inaccurate,
- inventory drag jumps toward the bottom edge of the screen,
- board and inventory feel like two separate DnD implementations even though TileEngine should own generic tile interaction.

## Library-first analysis

Keep Motion as the gesture/animation owner for this bugfix. The installed Motion stack already provides manual drag controls, snap-to-cursor, drag constraints, drag threshold configuration, `whileTap` / `whileDrag`, and transition bounce knobs. Pulling in `@use-gesture/react` would add a second gesture runtime for a problem Motion already covers.

Decision:

- no new dependency,
- use `useDragControls` with `snapToCursor`,
- keep physical drag, tactile scaling, constraints, and drop handoff in TileEngine,
- keep Arkini command/drop semantics outside TileEngine,
- pass only generic actor keys and rects between drag runtime and visual animation adapters.

## Root causes found

- TileEngine moved the dragged actor into `position: fixed` during active pointer drag. Inside the animated inventory bottom sheet this interacts badly with transformed ancestors, so inventory actors could visually jump toward the screen bottom.
- `onLostPointerCapture` cancelled sessions even after Motion had started a real drag. That can kill the drop path before board move/merge resolves.
- Drop handling reset the local drag visual immediately after calling `onDrop`, instead of waiting for the app-level accept/reject/ignore pipeline to stage the follow-up animation.
- Rejected return animation had no generic actor key, so the app animation adapter could not stage the return on the real actor.
- Accepted command animations were staged from old source locations rather than the actual dragged rect at pointer release.

## Completed

- TileEngine actors now use Motion manual drag controls with `dragListener={false}` and `controls.start(event, { snapToCursor: true, distanceThreshold })`.
- Dragged actors stay in the same absolute TileEngine actor layer instead of switching to `position: fixed`.
- The TileEngine root no longer clips transformed actors, so board drags can move within the configured play-root constraints instead of being visually chopped by the board container.
- Normal `lostpointercapture` no longer cancels an already-started Motion drag.
- Active drag visuals get tactile Motion feedback through `whileTap`, `whileDrag`, elastic constraints, and bounce transition knobs.
- Drop handling now waits for the async drop pipeline before fully restoring the local actor state.
- TileEngine temporarily hides the local actor during drop handoff until app-level motion is staged, preventing double actors and snap-back flicker.
- Drag runtime now returns explicit drop outcomes: `accept`, `reject`, `ignore`.
- Accepted drop commits receive a generic `DropCommitContext` containing the actual drag-end rect and actor key.
- Command visual staging uses the drag-end rect only for the dragged source actor, not every event in the command result.
- Board and inventory drag payloads now include generic actor keys.
- Rejected return animation now stages through the actor key, so invalid drops can animate back instead of silently no-oping.

## Acceptance

- [x] Dragging a board item to an empty board cell calls the normal `board.move` accept path and stages visual motion from the actual released actor rect.
- [x] Dragging a board item onto a merge target calls the normal `board.merge` accept path and animates the consumed source from the released actor rect.
- [x] Dragging a board item onto a swap target calls the normal `board.swap` accept path and animates the dragged source from the released actor rect.
- [x] Rejected drops can return through the same generic actor key used by board/inventory visual motions.
- [x] Inventory actors no longer switch to fixed positioning inside the bottom sheet.
- [x] Corner grabs use Motion snap-to-cursor for more precise pointer targeting.
- [x] Board and inventory still inject only rules/semantics; TileEngine owns the generic physical drag and tile actor motion handoff.
- [x] TileEngine remains standalone and does not import Arkini board/inventory/command/play domains.

## Validation

- Static syntax check over changed TypeScript/TSX files passed through TypeScript transpilation.
- `git diff --check` passed.
- Full `npm run typecheck` could not complete meaningfully because the uploaded ZIP has no `node_modules` or lockfile, and `npm install` timed out in the sandbox. The resulting TypeScript errors are dependency-resolution noise from missing packages, not a successful project compile.

## Manual validation still required

Run these in a browser because touch/drag feel cannot be proven by static checks:

- board item move to empty cell,
- board item merge,
- board item swap,
- invalid board drop return,
- board item drag into inventory nav/drop target,
- inventory slot swap,
- inventory invalid drop return,
- corner grab on board and inventory actors,
- drag inside inventory bottom sheet while the sheet is transformed/open.
