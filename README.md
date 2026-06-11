# Arkini

Client-only offline merge-game prototype. The app is a static SPA, not a server app. If a future change adds SSR, server functions, or runtime HTTP APIs, assume a small architecture goblin escaped and put it back in the cage.

## What the game is supposed to become

Arkini is a classic 1×1 tile merge game with a second economy layer:

- The board is the active play space. Items are dragged, merged, and produced there.
- Inventory is limited storage. Items stack there up to each item definition's `maxStackSize`.
- Merging happens only on the board. Inventory does not auto-merge, because then the board becomes decorative sadness.
- Producers live on the board and drop items around themselves. If there is not enough free space, production should fail without spending cooldown.
- Producers always have cooldowns. No spam-clicking like caffeinated raccoons.
- Producers may be infinite, like a town hall, or finite, like a crate that empties and disappears.
- Blueprints are consumable inventory items. Building/crafting consumes a blueprint plus inventory materials, then places the result on the board.
- Everything remains 1×1. Multi-tile buildings are explicitly out of scope.
- Producer upgrades are merges. Two `townhall-1` items become `townhall-2`; the new producer starts with default fresh state.

## Stack

- Vite + React SPA
- TanStack Router, code-based route tree, hash history for static hosting
- TanStack Query for async local state flows
- Tailwind CSS v4 through the Vite plugin
- SQLite in browser OPFS via SQLocal
- Kysely typed query layer
- Bun-first scripts, npm fallback when the world is being difficult

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

The router currently uses hash history, so static hosts do not need SPA rewrite rules for future client routes. Ugly URL hashes are less ugly than a server requirement, which is a sentence humanity somehow earned.

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

GitHub Pages does not provide normal custom response headers, so `apps/arkini/public/coi-serviceworker.js` is used as a static-host fallback. On the first visit it registers, reloads once, and then re-serves same-origin files with COOP/COEP headers. Proper headers are still preferred whenever hosting supports them.

## Source layout

```txt
apps/arkini
  index.html                 Static SPA entry document.
  src/main.tsx               Browser-only React entry. Ensures COI before rendering.
  src/router.tsx             TanStack Router + Query provider. No generated route tree.
  src/screens/HomeScreen.tsx Current playable prototype shell.
  src/components/GameShell.tsx
                             Button-first board/inventory/build UI. Drag comes later.
  src/hooks/useGameView.ts   Tiny TanStack Query bridge over local DB actions.
  public/coi-serviceworker.js Static-host COOP/COEP fallback.

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

This is still not the final drag-and-drop game. It is a deliberately boring button-first gameplay slice so the data model proves itself before animations and touch UX arrive to make everything more dramatic. Current actions:

- select an inventory stack, then click an empty board cell to place one item
- select a board item, then select another identical board item to merge into the next manifest-defined level
- select a board producer and click produce; drops appear around it only when enough free adjacent space exists
- finite producers, such as crates, spend charges and disappear when depleted
- select a blueprint build recipe, then click an empty board cell to consume blueprint/materials from inventory and place the result
- stash a board item back into inventory, respecting stack size and slot limits
- reset save for prototype testing
- hard reset the whole OPFS database when migrations changed during local development

The code is intentionally small and direct. `packages/db/src/gameplay.ts` is the gameplay boundary for now. Keep new mechanics there until there is actual pressure to split them; do not create a service cathedral because one function got mildly embarrassed.

## Development hard reset

Browser OPFS databases persist across rebuilds. During early development we do **not** support backward compatibility for stale local schema. If a migration changed and your local DB starts crying about a missing column, use the **Hard reset DB + rerun migrations** button in the SQLite status card.

That button deletes the SQLocal OPFS database file, reloads the app, then the normal boot path runs all migrations from an empty database and syncs the manifest. Brutal, clean, and vastly better than keeping prototype schema-repair code around like a cursed family heirloom.

## Data rules

The static game data has exactly one source of truth:

```txt
packages/game-data/src/index.ts
```

That manifest defines:

- board size and inventory slot count
- SVG assets
- items and max stack sizes
- merge definitions
- drop tables
- producer definitions and cooldowns
- finite/infinite producer modes
- build recipes
- starting inventory/board state

Migrations create database shape. The manifest creates game content. Do not hide balance changes in migrations unless you enjoy leaving landmines for the next model, which is rude even by software standards.

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

Avoid class inheritance and avoid one obese nullable item object. Keep gameplay operations small and direct. A tiny helper that removes duplication is fine; a helper that exists because someone wanted to feel architectural should be deleted with theatrical contempt.

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
