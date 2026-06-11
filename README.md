# Arkini

Client-only offline merge-game prototype. This is a plain static Vite + React SPA. No monorepo, no server runtime, no SSR, no server functions, no runtime HTTP API. The only persistence is browser OPFS SQLite.

## What the game is supposed to become

Arkini is a classic 1×1 tile merge game with a second economy layer:

- The board is the active play space. Items are dragged, merged, produced, and placed there.
- Inventory is limited 3×9 vertical storage. Items stack there up to each item definition's `maxStackSize`.
- Merging happens only on the board. Inventory stores and swaps stacks, but does not auto-merge.
- Producers live on the board and drop items around themselves. If there is not enough free space, production fails without spending cooldown.
- Producers always have cooldowns. Rapid repeat clicking is blocked.
- Producer drops animate out one by one instead of appearing as one ugly pile of instant database truth.
- Producers may be infinite, like a town hall, or finite, like a crate that empties and disappears.
- Blueprints are consumable inventory items. Click an empty board cell, choose an owned blueprint from the build modal, then building consumes blueprint plus inventory materials and places the result on the board.
- Everything remains 1×1. Multi-tile buildings are explicitly out of scope.
- Producer upgrades are merges. Two `townhall-1` items become `townhall-2`; the new producer starts with default fresh state.

## Stack

- Vite + React SPA
- TanStack Router, code-based route tree, hash history for static hosting
- TanStack Query for async local state flows
- Tailwind CSS v4 through the Vite plugin
- DnD Kit for the single drag-and-drop interaction model
- Sonner for rare toast-level feedback without a concrete tile/slot target
- SQLite in browser OPFS via SQLocal
- Kysely typed query layer
- Bun-first scripts; npm works when Bun is not available

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
VITE_BASE=/arkini/ bun run build
```

The repository includes `.github/workflows/pages.yml`, which runs from the repo root, builds with `VITE_BASE=/arkini/`, and uploads `dist` to GitHub Pages. The router uses hash history, so static hosts do not need SPA rewrite rules for future client routes.

## OPFS and cross-origin isolation

SQLocal persists SQLite into OPFS, which requires the page to be cross-origin isolated. The clean production solution is to serve these headers for every file:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Configured places:

- Vite dev/preview headers: `vite.config.ts`
- Static `_headers` file for hosts that support it: `public/_headers`
- Vercel headers: `vercel.json`

GitHub Pages does not provide normal custom response headers, so `public/coi-serviceworker.js` is the static-host COI path. On the first visit it registers, reloads once, and then re-serves same-origin files with COOP/COEP headers. Proper headers are still preferred whenever hosting supports them.

## Source layout

```txt
index.html                  Static SPA entry document.
vite.config.ts              Vite, Tailwind, SQLocal, dev COOP/COEP headers.
public/                     Static assets, .nojekyll, _headers, COI service worker.

src/main.tsx                Browser-only React entry. Ensures COI before rendering.
src/router.tsx              TanStack Router + Query provider. No generated route tree.
src/screens/HomeScreen.tsx  Minimal app header and playable prototype shell.

src/domains/game-data/      The single static game-data manifest and SVG assets.
src/domains/database/       SQLocal/Kysely client, schema migrations, manifest sync, save, gameplay persistence.
src/features/game/          Playable game UI orchestration, panels, DnD helpers, transient animation state.
src/components/             App-level shared UI only, currently the database status card.
src/hooks/                  Tiny TanStack Query bridge over local database actions.
```

The app is now a normal repo. Do not add `apps/*`, `packages/*`, workspace package aliases, or other monorepo ceremonies unless there is an actual second app/package that earns its keep. Tiny projects do not need a shipping container to carry a sandwich.

## Current playable blocks

The prototype uses one primary interaction model: drag and drop through `@dnd-kit/core`. Current actions:

- drag an inventory stack onto an empty board cell to place one item
- double-click an inventory stack to animate one item into the first free board cell
- drag an inventory stack onto another inventory slot to move/swap stacks
- drag a board item onto an empty board cell to move it
- drag a board item onto a valid merge target; cells show valid/invalid feedback before drop, the dragged overlay fades over valid merge targets, and successful merges scale-pulse the target
- double-click a producer to produce; it remains selected so its details do not flicker away after the action
- producer drops are staged, hidden, and revealed one by one with flyout animation from the producer into target cells
- producer tiles have a distinct generator treatment and show cooldown progress directly in the tile background; cooldown failures flash the tile instead of also throwing a toast
- invalid drops animate back to their source while the source stays hidden until the return finishes
- finite producers, such as crates, spend charges and disappear when depleted
- hover an empty board cell to see the hammer build affordance, then click it to open the owned-blueprint build modal
- drag a board item onto inventory to store it; existing compatible stacks are preferred before empty slots and the chosen slot pulses. Cooling producers cannot be stashed, because that would bypass their timer like a tiny local exploit
- double-click a non-producer board item to animate it into the resolved inventory stack/slot
- hard reset the whole OPFS database when migrations change during local development

## Development hard reset

Browser OPFS databases persist across rebuilds. During early development we do **not** support backward compatibility for stale local schema. If a migration changed and your local DB reports a missing column, use the **Hard reset DB** button in the SQLite status card.

That button deletes the SQLocal OPFS database file, reloads the app, then the normal boot path runs all migrations from an empty database and syncs the manifest.

## Data rules

The static game data has exactly one source of truth:

```txt
src/domains/game-data/index.ts
```

That manifest defines:

- board size and 3×9 inventory slot count
- SVG assets
- items and max stack sizes
- merge definitions
- drop tables
- producer definitions and cooldowns; upgraded producers still drop some low-tier materials so build recipes do not soft-lock
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

## Minimal-code philosophy

Use data before code. An item is the base identity. Behavior comes from optional definitions:

- merge definition: can merge into another item
- producer definition: can generate drops
- build recipe: blueprint can craft/place a result

Avoid class inheritance and avoid one large nullable item object. Keep gameplay operations small and direct. Split by domain when files start mixing responsibilities, but do not invent “frameworks inside the framework” just to feel productive. Humanity has suffered enough.

## Commit hygiene

Commits should explain architectural movement, not just file churn. Good examples:

- `Replace Start with static TanStack Router app`
- `Centralize game definitions in manifest sync`
- `Add producer and blueprint data model`
- `Flatten app into a plain SPA repo`

Bad examples:

- `update`
- `stuff`
- `fix maybe`

The repository history is part of the handoff memory for future agents and future tired humans.


## Current interaction notes

- Board and inventory grids intentionally use zero cell gap so DnD has no blind spots between cells.
- Invalid drags keep the drag overlay mounted until the return animation finishes; successful drops still hide the source immediately.
- GitHub Pages builds copy `.nojekyll` into `dist` after Vite finishes so Pages serves the SPA without Jekyll interference.
- Inventory is now 4 × 9. During development, use the hard DB reset after manifest slot changes.
