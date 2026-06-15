# Overhaul TileEngine drag and drop

Status: TODO
Priority: CRITICAL

## Goal

Revisit the whole drag/drop runtime. Current behavior is not trustworthy enough for a game: items do not snap reliably, actors can fly out of the board, swap placement feels random, and confinement is wrong across board vs inventory.

The output of this task must be a stable TileEngine-owned DnD interaction layer where pointer drag, hit testing, confinement, drop settlement, and rejected-return behavior are deterministic.

## Reported symptoms

- Board items sometimes do not attach/snap to the intended board cell.
- Items can visually fly out of the board after drag/drop.
- Swap behavior is random-feeling and actors do not land in the expected slots.
- Confinement is wrong:
  - board drag confinement should be the whole play/root board interaction area,
  - inventory drag confinement should be the inventory cell container/surface, not the whole root.
- Accepted drop, rejected drop, cancel, and rollback are visually too easy to desync.

## Current technical risk areas

- `TileEngineActor` switches an active actor to `position: fixed` using its starting DOM rect and motion values. That is useful for pointer-follow, but it makes surface-relative confinement easy to get wrong.
- Drop target resolution currently uses `document.elementsFromPoint(...)` plus a global drop target registry. This can confuse board/inventory/bottom-nav targets if overlays, sheets, hidden actors, pointer-events, or z-index change.
- Confinement is not modeled as a first-class public TileEngine concept. It is currently an accidental result of CSS, fixed positioning, target lookup, and caller behavior. Naturally it behaves like cursed soup.
- Accepted drop state changes and animation staging are now routed through command visual events, but the interaction layer still has generic return/cancel physics that must be reconciled with TileEngine actor state.
- Board and inventory have different desired drag surfaces. They cannot share one implicit viewport/root constraint.

## Required design rules

- Keep `src/tile-engine` standalone. No Arkini imports, no `itemId`, no board/inventory/activation/command knowledge.
- Arkini-specific behavior may be injected through TileEngine public props/hooks/adapters.
- TileEngine may expose generic DnD extension points such as:
  - `drag.surface(...)`,
  - `drag.constrain(...)`,
  - `drag.resolveTarget(...)`,
  - `drag.onStateChange(...)`,
  - or equivalent hook-style props.
- Pointer move must not cause React re-renders per frame.
- Active drag visual state should use MotionValues or equivalent imperative primitives.
- Slot/target geometry must be refreshed on layout change, not recomputed as React state on every pointer move.
- Actor identity must stay stable across move/swap/drop settlement. Slot is location; actor is entity. Do not key actors by slot.

## Proposed work

### 1. Model drag surfaces explicitly

Introduce a generic TileEngine concept for a drag surface/viewport.

Possible shape:

- `surfaceId`
- root element ref or resolver
- constraint rect resolver
- hit-test strategy
- optional scroll/viewport conversion

Board and inventory should each pass their own surface behavior:

- board: confinement root should be the full board/play surface that represents valid board drag movement,
- inventory: confinement should be the inventory grid/cell container,
- bottom nav target can remain an injected special target, but must not expand inventory confinement.

### 2. Replace accidental confinement with explicit clamp

During active drag, compute the visual actor rect as:

- pointer delta from origin,
- clamp against the active source surface constraint rect,
- preserve actor size,
- expose unclamped pointer position separately for target hit-testing if needed.

This prevents the actor from flying out while still allowing target resolution to know where the pointer is.

### 3. Make hit testing deterministic

Avoid relying purely on `document.elementsFromPoint` as the only source of truth.

Options:

- maintain a generic TileEngine target rect registry per surface,
- use grid math for uniform surfaces,
- resolve target by pointer position in active surface coordinates,
- keep DOM fallback only for special injected targets like bottom nav.

Board/inventory are grids. Hit testing should be boring. Boring hit testing is good. Exciting hit testing is how games become bug reports with sprites.

### 4. Separate pointer rect and actor rect

Accepted drop planning currently receives a `dragRect`. Make sure this represents the clamped actor visual rect, while target selection uses pointer location. These are not always the same when the actor is confined.

### 5. Rebuild swap settlement expectations

Document and enforce swap visual contract:

- dragging actor follows pointer while active,
- on accepted swap, domain command emits `item.swapped`,
- command visual events stage final actor motions,
- source/target actors settle into their final slots,
- no actor should render from stale slot geometry after invalidation.

### 6. Test all lifecycle exits

Manual scenarios:

- board item move to empty board cell,
- board item swap with occupied board cell,
- board merge,
- board feed producer/stash/craft input,
- board item drag into inventory nav target,
- inventory slot swap,
- inventory item place on board,
- drag outside valid target then return,
- pointer cancel / window blur / orientation change / resize,
- long press does not open native mobile context menu.

## Acceptance

- Board drag is visually confined to the intended board/root surface.
- Inventory drag is visually confined to the inventory grid/cell container.
- Dropping on a valid board cell always resolves that exact cell.
- Dropping on a valid inventory slot always resolves that exact slot.
- Swap always places both actors into their expected final slots.
- Invalid drop returns to the source actor origin without leaving hidden/ghost state behind.
- Cancel paths clear active drag, active target highlight, hidden sources, and motion state.
- Pointer move does not re-render board/inventory per frame.
- TileEngine remains standalone; grep confirms no imports from Arkini domains.
- Typecheck and build pass.

## Watchouts

- Do not solve this by reintroducing `dnd-kit`.
- Do not leak Arkini command visual events into TileEngine.
- Do not put board/inventory coordinate types inside TileEngine.
- Do not add one-off DOM hacks for a single symptom. This task is a system revisit, not bug whack-a-mole.
- Keep native mobile long-press menu suppressed.
