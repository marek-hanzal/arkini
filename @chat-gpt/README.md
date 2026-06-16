# ChatGPT working map

Status: ACTIVE
Updated: 2026-06-16

This directory is the repo-local working memory for GPT-led Arkini work. Treat this file as the current truth. Older task files are retained as audit trail, not as instructions to blindly execute like a cursed treasure map.

## Current mental model

Arkini v0 is a client-only/offline Vite + React SPA. No SSR, no server runtime. Durable save state lives in browser OPFS SQLite through SQLocal/Kysely. Static game truth lives in `src/v0/manifest/GameConfig.ts`, composed from focused files under `src/v0/manifest/config`.

The active runtime has four layers:

1. `manifest` defines all static gameplay data and IDs.
2. SQLite + migrations store mutable save/runtime state.
3. domain `fx/` roots implement backend-like use-cases through Effect.
4. React Query + UI components render cached views and apply visual optimistic patches.

`TileEngine` is generic tile interaction infrastructure: pointer lifecycle, hit testing, drop target geometry, snap/rollback, handoff and tile motion. It must not know Arkini game rules. Game-specific drop policy belongs in `src/v0/play/drop`; board/inventory adapter wiring belongs in concrete hooks such as `useBoardTileEngineModel` and `useInventoryTileEngineModel`.

## Hard boundaries

These are now enforced by `npm run dc` through dependency-cruiser where possible:

- `src/v0/tile-engine` must not import Arkini domains such as board, inventory, play, manifest, item, activation, database, craft, upgrade or game.
- `src/v0/manifest` must not import runtime/UI/persistence domains.
- domain `fx/` roots must not import React or React Query.
- production code must not import tests.
- production `src` code must not import devDependencies, except type/test-only edges covered by config exceptions.
- `~/v0/play/resolveDrop` wrapper is gone; use `~/v0/play/drop/resolveDrop` directly.

If dependency-cruiser complains, fix the boundary. Do not weaken the rule unless the rule is genuinely wrong for the architecture, because otherwise we are just letting the mess negotiate with us. Software does that enough already.

## Standard task start

Before coding:

1. Read this file.
2. Run or inspect `git status --short --branch`; if `.git` is missing, stop.
3. Do a library-first check: use installed libraries before writing in-house infrastructure, and consider a small focused dependency when custom code would be worse.
4. Identify the owning domain before adding files. No `shared` trash cans unless the ownership is truly generic UI/infrastructure.

## Standard task finish

Run the full gate unless the task is explicitly docs-only:

```bash
npm run check
npm run build
git diff --check
```

`npm run check` runs format check, dependency boundaries, typecheck, and Vitest. Run `npm run build` separately before packaging non-doc work. This two-step gate avoids forcing every small test cycle through the production bundle, because waiting on bundlers for tiny pure tests is how machines learn resentment.

Then commit and package a fresh zip including `.git` plus a SHA256 file. Zip names must stay unique to dodge cache weirdness, because apparently downloading a file is still a boss fight.

## Current commands

```bash
npm install --no-package-lock
npm run dev
npm run dc
npm run test
npm run check
```

Arkini uses npm without a committed lockfile. Do not add `package-lock.json`, `bun.lockb`, or similar unless the dependency policy changes deliberately.

## Dev Sheet and bug reports

The bottom nav `Dev` sheet replaces the old database-only sheet. It keeps the OPFS/SQLite status and hard reset button, but adds a `Copy bug report` button for animation/debug work.

Dev builds expose two console APIs:

```js
window.__ARKINI_BUG_REPORT__.dump()
window.__ARKINI_BUG_REPORT__.copy()
window.__ARKINI_BUG_REPORT__.clear()
window.__ARKINI_DEBUG_TIMELINE__.entries()
```

Bug reports are boring JSON on purpose: browser metadata, active sheet/error context, React Query cache snapshots for board/inventory/database, query states and the latest timeline entries. The timeline records TileEngine pointer/drag/drop/motion lifecycle, action mutation phases, optimistic cache restores and visual-event patch sequencing. When Marek reports an animation bug, ask for: scenario/actions, visible symptom, and the copied bug report dump. Fewer vibes, more evidence, humanity heals slightly.

## Active improvement priorities

1. Keep `applyActionResultCachePatch` thin. Board and inventory visual event patching already live in focused pure helpers; continue that direction.
2. Add more Vitest coverage around domain action results, cache patches, placement planning and manifest validation.
3. Keep board/inventory surfaces as render shells; put TileEngine model wiring in concrete adapter hooks.
4. Expand debug timeline only where it helps bug reports. Do not build a giant debug cockpit unless the game actually needs it.
5. Keep manifest content editable through small topic files and a documented checklist rather than inventing a config framework that cosplays as productivity.

## Backlog conventions

Task files live in `000-refactor-backlog/`.

Status values:

- `TODO` means not started.
- `IN_PROGRESS` means partly done and still relevant.
- `DONE` means completed in a committed change.
- `BLOCKED` means waiting for a product/design decision.
- `OBSOLETE` means replaced by newer architecture or task notes.

Do not delete completed task files. Update status and add a short result note. Old dated audit notes in this folder are reference material only; this README wins when they disagree.
