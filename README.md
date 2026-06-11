# Arkini

Client-only offline merge-game prototype. The app is a static SPA, not a server app. Future changes must not add SSR, server functions, or runtime HTTP APIs.

## What the game is supposed to become

Arkini is a classic 1×1 tile merge game with a second economy layer:

- The board is the active play space. Items are dragged, merged, and produced there.
- Inventory is limited 7×3 storage. Items stack there up to each item definition's `maxStackSize`.
- Merging happens only on the board. Inventory does not auto-merge because the board is the core play space.
- Producers live on the board and drop items around themselves. If there is not enough free space, production should fail without spending cooldown.
- Producers always have cooldowns. Rapid repeat clicking is intentionally blocked.
- Producers may be infinite, like a town hall, or finite, like a crate that empties and disappears.
- Blueprints are consumable inventory items. Building/crafting consumes a blueprint plus inventory materials, then places the result on the board.
- Everything remains 1×1. Multi-tile buildings are explicitly out of scope.
- Producer upgrades are merges. Two `townhall-1` items become `townhall-2`; the new producer starts with default fresh state.

## Stack

- Vite + React SPA
- TanStack Router, code-based route tree, hash history for static hosting
- TanStack Query for async local state flows
- Tailwind CSS v4 through the Vite plugin
- DnD Kit for the single drag-and-drop interaction model
- Sonner for rare toast-level feedback
- SQLite in browser OPFS via SQLocal
- Kysely typed query layer
- Bun-first scripts; npm works when Bun is not available

No TanStack Start. No SSR. No server routes. No running server beyond static file serving.

## Run

```bash
bun install
bun run dev
```

If Bun is not available:

```bash
npm install --no-package-lock
npm run dev
```

## Build

```bash
bun run build
```

For GitHub Pages under a repository path, set the Vite base:

```bash
VITE_BASE=/your-repo-name/ bun run build
```

The router currently uses hash history, so static hosts do not need SPA rewrite rules for future client routes.

## OPFS and cross-origin isolation

SQLocal persists SQLite into OPFS, which requires the page to be cross-origin isolated. The clean production solution is to serve these headers for every file:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Configured places:

- Vite dev/preview headers: `apps/arkini/vite.config.ts`
- Static `_headers` file for hosts that support it: `apps/arkini/public/_headers`
- Vercel headers: `apps/arkini/vercel.json`

GitHub Pages does not provide normal custom response headers, so `apps/arkini/public/coi-serviceworker.js` is the static-host COI path. On the first visit it registers, reloads once, and then re-serves same-origin files with COOP/COEP headers. Proper headers are still preferred whenever hosting supports them.

## Source layout

```txt
apps/arkini
  index.html                 Static SPA entry document.
  src/main.tsx               Browser-only React entry. Ensures COI before rendering.
  src/router.tsx             TanStack Router + Query provider. No generated route tree.
  src/screens/HomeScreen.tsx Current playable prototype shell.
  src/components/GameShell.tsx
                             Drag-first board, inventory, producer, and build UI.
  src/hooks/useGameView.ts   Tiny TanStack Query bridge over local DB actions.
  public/coi-serviceworker.js Static-host COOP/COEP service worker.

packages/game-data
  src/index.ts               The single static game-data manifest.
  src/svg/*.svg              Tiny SVG assets referenced by the manifest.

packages/db
  src/migrations             Schema only. Do not put item balance here.
  src/syncGameData.ts        Idempotent manifest-to-SQLite sync on every bootstrap.
  src/save.ts                Creates the default save once, then leaves player state alone.
  src/gameplay.ts            Small direct actions: place, stash, merge, produce, build, reset.
```

## Current playable blocks

The prototype uses one primary interaction model: drag and drop through `@dnd-kit/core`. There is no click-placement path. Current actions:

- drag an inventory stack onto an empty board cell to place one item
- drag a board item onto an empty board cell to move it
- drag a board item onto a valid merge target; cells show valid/invalid feedback before drop
- double-click a producer to produce; drops appear around it only when enough free adjacent space exists
- producer tiles show cooldown progress directly in the tile background
- finite producers, such as crates, spend charges and disappear when depleted
- drag a blueprint build recipe onto an empty board cell to consume blueprint/materials from inventory and place the result
- drag a board item onto inventory to store it; existing compatible stacks are preferred before empty slots
- double-click a non-producer board item to animate it into the resolved inventory stack/slot
- reset save for prototype testing
- hard reset the whole OPFS database when migrations changed during local development

The code is intentionally small and direct. `packages/db/src/gameplay.ts` is the gameplay boundary for now. Keep new mechanics there until there is actual pressure to split them.

## Development hard reset

Browser OPFS databases persist across rebuilds. During early development we do **not** support backward compatibility for stale local schema. If a migration changed and your local DB reports a missing column, use the **Hard reset DB + rerun migrations** button in the SQLite status card.

That button deletes the SQLocal OPFS database file, reloads the app, then the normal boot path runs all migrations from an empty database and syncs the manifest.

## Data rules

The static game data has exactly one source of truth:

```txt
packages/game-data/src/index.ts
```

That manifest defines:

- board size and 7×3 inventory slot count
- SVG assets
- items and max stack sizes
- merge definitions
- drop tables
- producer definitions and cooldowns; Town Hall producers are intentionally short during prototype testing
- finite/infinite producer modes
- build recipes
- starting inventory/board state

Migrations create database shape. The manifest creates game content. Do not hide balance changes in migrations.

On every app bootstrap:

1. Browser capability checks run.
2. Kysely migrations run.
3. `syncGameDataManifest()` validates and synchronizes all static definition tables.
4. `ensureDefaultSaveGame()` creates the initial save only if it does not exist.

When schema changes during pre-release development, hard-reset the local OPFS DB instead of writing compatibility patches.

The sync disables stale top-level definitions instead of hard-deleting item definitions, because old saves may still reference old item IDs. Drop-table entries are regenerated because they are pure manifest cache.

## Minimal-code philosophy

Use data before code. An item is the base identity. Behavior comes from optional definitions:

- merge definition: can merge into another item
- producer definition: can generate drops
- build recipe: blueprint can craft/place a result

Avoid class inheritance and avoid one large nullable item object. Keep gameplay operations small and direct. A tiny helper that removes duplication is fine; speculative abstractions should be removed.

## Commit hygiene

Commits should explain architectural movement, not just file churn. Good examples:

- `Replace Start with static TanStack Router app`
- `Centralize game definitions in manifest sync`
- `Add producer and blueprint data model`
- `Add playable board inventory producer blocks`

Bad examples:

- `update`
- `stuff`
- `fix maybe`

The repository history is part of the handoff memory for future agents and future tired humans.
