# v0 repo mental model audit

Status: DONE
Commit: see git log for `Audit v0 repo mental model`
Date: 2026-06-16

## Scope

Review the current repository state as a handoff target for future GPT work. The goal is not a gameplay rewrite. The goal is to make the repo easier to reason about inside the current project conventions, because a model should not need to rediscover the whole civilization every time Marek throws another zip over the wall.

## Library-first check

Installed libraries already cover the infrastructure that matters right now:

- React owns UI rendering; `GameRuntimeStore`/`useSyncExternalStore` owns live gameplay subscriptions. React Query is now only for remaining async/static app data such as item catalog/debug/database utilities, not board/inventory gameplay state.
- Motion owns actual DOM animation primitives.
- Effect owns server-like gameplay operations and service boundaries.
- Kysely + SQLocal own browser SQLite persistence.
- Zod owns runtime shape checks for config, rows, and view data.
- ts-pattern owns exhaustive domain branching where that improves readability.

No new dependency is justified for this audit. The most fragile active area is not missing a library; it is keeping ownership boundaries sharp enough that TileEngine does not become a tiny custom framework with game rules hiding in its pockets.

## Current mental model

Arkini v0 is now understandable as four layers:

1. `GameConfig` defines all static gameplay data: item identities, asset mapping, merge rules, producers, loot tables, upgrades, craft behavior, and starting state.
2. `RuntimeGameEngineAdapter` owns the live `(config, save)` gameplay runtime and dispatches typed tick/action commands through the standalone Effect engine.
3. `GameRuntimeStore` exposes runtime snapshots to React through `useSyncExternalStore` selectors. Board/inventory/upgrade gameplay UI must read and write through this runtime path, not through React Query caches or old SQLite mutation hooks.
4. `TileEngine` owns transient pointer/motion behavior; `play/drop` maps generic drag/drop events into runtime actions, and runtime visual effects translate engine domain events into animation requests.

The repo is in a workable state. It is no longer a root-runtime soup, and the active `src/v0` tree has a mostly crisp shape. Domain folders are specific enough that navigation is sane: `game/engine` owns standalone rules, `play/runtime` owns React-facing subscriptions/actions, board/inventory own view/render contracts, manifest owns static data, and TileEngine stays game-agnostic.

## What is easy to work with

The biggest win is the single config spine. Once a model finds `GameConfig`, item definitions, loot tables, and derived indexes, the gameplay data stops feeling magical. The split manifest files are large, but they are honest large files, not stealth abstractions pretending to be elegant while leaking nonsense everywhere.

The Effect boundary is also good. Domain mutations read like backend use-cases, and UI code does not have to drag Effect into components. That makes the repo mentally linear: find action hook, find Fx root, find validation/storage helper. Beautifully boring, which is high praise in software and a damning comment on our species.

The current TileEngine split is much better than a monolith. Pointer down/move/up, actor motion, drops, slots, handoff, and timing are separate enough to debug without scrolling through a ritual scroll.

## What still costs mental energy

`BoardSurface` and `InventorySurface` are still chunky wiring components. They are acceptable right now, but they are where future interaction complexity will collect if nobody watches the door. If they grow, split adapter creation and action wiring into concrete files, not into one cursed generic `useGameRuntime` bag.

The old board/inventory React Query cache bridge is gone. Do not resurrect `applyActionResultCachePatch` or cache-owned gameplay state; runtime save is now the source of truth and visual events should feed TileEngine motion only.

`TileEngine` is game-agnostic again after this audit, but it still depends on a module-level drop registry. That is okay for one visible board and one sheet, because drop IDs are distinct and unmount cleanup exists. If multiple same-id engines ever appear at once, the registry should become instance-scoped before it starts doing haunted-house bullshit.

The zip had a `package-lock.json` present even though `.gitignore`, README, and CI all say no committed lockfile. That is exactly the kind of tiny contradiction that makes future agents waste time deciding which instruction is real. The current tree now follows the documented no-lockfile policy.

## Changes made in this pass

- Resized `src/assets/item-epic-key.png` from `1254x1254` / about `1.16 MB` to `128x128` / about `23 KB`.
- Removed the ignored `package-lock.json` from the working tree so the packaged repository matches `.gitignore`, README, and the GitHub Pages workflow.
- Moved the tile enter-motion schema from `play/motion` into `tile-engine` as `TileEnterMotionSchema`, so `src/v0/tile-engine` no longer imports the Arkini `play` domain.

## Recommended next improvement plan

1. Keep `TileEngine` isolated. Add a small import audit to future TileEngine tasks: it may import React, Motion, Zod, `~/v0/ui`, and `~/v0/tile-engine/*`; it should not import board, inventory, play, manifest, item, activation, or database.
2. Keep gameplay React Query-free. If a UI path reads/writes board, inventory, producer, stash, craft or upgrade runtime state, it should use `GameRuntimeStore` selectors/actions.
3. Extract concrete Board/Inventory TileEngine adapter builders only when the surfaces grow. Do not make a generic runtime hook unless the API stays obviously smaller than the components it replaces.
4. Keep generated/large assets on a hard size budget. Item PNGs should normally be `128x128`; larger source art belongs outside runtime assets unless deliberately needed.
5. Add focused debug tooling before adding more animation behavior: one overlay for slot rects/drop ids and one action-event trace panel would pay for itself fast, because debugging drag geometry by vibes is how humans accidentally invented cursed UX.

## Verification checklist for this audit

Run before handoff:

```bash
npm install --no-package-lock
npm run format:check
npm run typecheck
npm run build
git diff --check
```

Also useful:

```bash
find src/v0/tile-engine -type f -name '*.ts*' -print0 \
  | xargs -0 rg "~/v0/(?!tile-engine|ui)" -n --pcre2
```

That command should return nothing.
