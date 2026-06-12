# Arkini

Client-only offline merge-game prototype. Plain Vite + React SPA, static-host friendly, no SSR, no server runtime, no HTTP API. Mutable player state lives in browser OPFS SQLite through SQLocal/Kysely. Static gameplay rules live in TypeScript.

## Current rewrite direction

This branch intentionally rewrites the gameplay slice from the ground up while keeping the existing stack: Vite, React, TanStack Router/Query, DnD Kit, Zustand dependency available but not required, Tailwind v4, Kysely, SQLocal, Zod, ts-pattern.

The core rule is simple: **item definitions drive gameplay shape**. An item may define:

- normal merge rules, for example `seed + seed -> sprout`
- mixed/secret merge rules, for example `twig + water -> sprout`
- click producers, which produce on a plain single click/tap
- optional item display labels, for example tiny level numbers over reused building art
- auto producers, which run by themselves, can be paused, have capacity, tick timing, and recharge timing
- blueprint build recipes

There are no separate static `merges`, `dropTables`, `producers`, and `buildRecipes` arrays anymore. Those are derived indexes over `src/domains/game-data/index.ts`. Humanity briefly survives another abstraction.

## Gameplay model

- Board is a 7×9 grid.
- Inventory is 36 slots shown from the bottom navigation. Database/debug controls live in the same sheet system.
- Board and inventory use zero-gap square cells to avoid DnD blind spots.
- Merging happens on the board only.
- Inventory stores stacks and can combine compatible stacks.
- Dragging one item out of an inventory stack with quantity greater than one keeps the source stack visible; it only disappears when the last item leaves. That old flicker bug can go sit in the bin.
- Producers place generated items into the board first. If the board is full, they spill into inventory. If neither board nor inventory has capacity for the whole production batch, the action is rejected before cooldown/charge/capacity is spent.
- Click producers use cooldowns and optional finite charges.
- Auto producers persist pause state, available capacity, next drop time, and recharge time in `boardItem.stateJson`.
- Auto producers tick from the client and save progress into SQLite, so reloads do not reset their timers like a cheap casino machine.
- Double-click board items to animate them into the inventory bottom area. Single click on producers still produces immediately; no delayed click timer is used.
- Double-click/tap an empty board cell to open the build sheet. Build, inventory, and database panels all share one always-mounted `react-modal-sheet` wrapper with snap points; the closed detent stays hidden under the bottom nav so panel animations remain stable.
- Dragging a board item lightly highlights known merge targets for accessibility. Rejected drops flash the target while the item flies back.
- Inventory-to-board placement fades the travelling item out under the inventory sheet and fades the target tile in after the commit.

## Dragging model

`src/features/game/useDraggableControl.ts` is deliberately domain-agnostic. It knows only about draggable payloads, droppable payloads, accept/reject plans, hidden source ids, generic return animation, and app-provided move animations. It does not branch on board, inventory, cells, slots, merges, producers, or any other game rule.

Game-specific policy lives in `src/features/game/useGameDraggableControl.ts`. That adapter translates board/inventory drops into generic accept/reject plans and calls gameplay mutations. Board and inventory components only describe payloads and visual source/target ids through the generic `DragSurface` components. If a new grid/surface is added later, wire it into the adapter rules, not into the generic control. Yes, this is the part where we try not to rebuild a tiny cursed browser physics engine three times.

## Source layout

```txt
src/domains/game-data/index.ts   Single source of truth for item identity and item behavior.
src/domains/game-data/schema.ts  Zod structural validation for the manifest.
src/domains/database/            OPFS SQLite bootstrap, schema, gameplay mutations, view projection.
src/features/game/GameShell.tsx  Fixed-viewport board, bottom navigation, shared bottom sheet orchestration, producer actions.
src/features/game/components/BottomSheet.tsx  Shared always-mounted react-modal-sheet wrapper with snap-point control.
src/features/game/useDraggableControl.ts  Generic DnD lifecycle/control engine.
src/features/game/useGameDraggableControl.ts  Arkini-specific accept/reject rules over the generic DnD engine.
src/hooks/useGameView.ts         TanStack Query bridge over the local SQLite backend.
```

## Local run

```bash
bun install
bun run dev
```

Fallback when Bun is not available:

```bash
npm install --no-package-lock
npm run dev
```

## Build

```bash
bun run build
```

For GitHub Pages under a repository path:

```bash
VITE_BASE=/arkini/ bun run build
```

The router uses hash history, so static hosts do not need SPA rewrite rules.

## OPFS and cross-origin isolation

SQLocal persists SQLite into OPFS, which needs the page to be cross-origin isolated. Serve these headers whenever hosting supports it:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Configured places:

- Vite dev/preview headers in `vite.config.ts`
- static `_headers` in `public/_headers`
- Vercel headers in `vercel.json`
- fallback service worker in `public/coi-serviceworker.js` for static hosts such as GitHub Pages

## Data rules

`src/domains/game-data/index.ts` is the only place to change balance and content. Migrations create storage shape. The manifest creates game rules.

On boot:

1. Browser capability checks run.
2. Kysely migrations run.
3. `syncGameDataManifest()` validates and hashes the manifest for debug visibility.
4. `ensureDefaultSaveGame()` creates the default save only when missing.

Prototype saves are disposable. If local OPFS state goes bad after data changes, use the always-visible database reset button. Do not add compatibility migrations or data-version branching for gameplay definitions.

## Minimal-code philosophy

Prefer direct data and small operations. Avoid class hierarchies, hidden frameworks, and helper confetti. When behavior can live on an item definition, put it there. When UI state is transient, keep it in the UI. When state must survive reloads, store it in SQLite. Everything else is probably just code wearing a fake mustache.
