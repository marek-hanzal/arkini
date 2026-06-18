# Arkini v0 notes index

Status: ACTIVE
Updated: 2026-06-18

This folder holds Arkini v0-specific working notes, completed task logs and follow-up plans. Root `@chat-gpt/README.md` is still the current high-level working map; this folder is the v0 archive/index so the root does not become a markdown landfill with ambitions.

## Current source of truth

- Live gameplay runtime: `RuntimeGameEngineAdapter` + `GameRuntimeStore` + `useSyncExternalStore` selectors.
- Static game config: compiled/validated `GameConfig` JSON from `game/arkini`.
- Persisted save: Dexie-backed `GameSave`, validated through `GameSaveConfigSchema` and wiped on incompatibility.
- Tile interaction: generic TileEngine + Arkini drop intent mapping. Requirements are filled through DnD/merge-like interactions, not special buttons.

## Active / useful task candidates

### 1. Producer board progress bar

Item sheet product progress is live, but the board tile should also show the currently running producer job as a small bottom progress bar. The old activation cooldown progress path is not the same as runtime producer jobs. Keep this subtle and reuse existing board progress UI where possible.

### 2. Tile detail executable-interaction parity

The item detail must not display interactions that `resolveDropIntent` / runtime actions cannot execute. Known reported example: water detail promised a water → twig interaction that did not work on board. Detail hints should come from the same canonical executable resolver or be clearly marked locked/unavailable.

### 3. Touch/long-press polish

Long press on game surfaces should not open native browser menus. Keep suppression scoped to board/tile surfaces so normal app UI is not wrecked for sport.

### 4. Badge/visual polish

Tile badge/level offset can be tightened toward the corner. Keep it tiny and do not redesign tile layout while pretending it is “just polish”.

## Deferred / historical notes

- `v0-effect-tick-engine-2026-06-17.md` and `v0-tick-engine-integration-readiness-2026-06-17.md` are historical architecture plans. The runtime engine path is now live.
- `v0-json-game-definition-plan-2026-06-17.md` is mostly implemented as the JSON package/compile/validate path; use it for rationale, not as a fresh TODO list.
- `v0-product-line-categories-2026-06-17.md` remains deferred until producer product-line UI actually needs authored grouping.
- `000-refactor-backlog/*` remains an epic-style backlog/archive. New small task logs can live directly in this folder when they are v0-specific.

## Selected next task

Recommended next coding task: **Producer board progress bar**.

Reason: placement now preserves spatial causality and blocked delivery now marks stuck producers. The next visible gameplay gap is that actively running producer jobs should show a subtle bottom progress bar directly on the board tile, so the board itself communicates that production is running instead of forcing the player to open the sheet like a tiny bureaucrat.

## Completed recent task

- `v0-producer-blocked-delivery-2026-06-18.md`: producer output rolls once, blocked delivery persists on the job, retries without spam/reroll, keeps queue capacity occupied, and marks blocked producer tiles with a subtle danger frame.
- `v0-local-placement-planner-2026-06-18.md`: shared Manhattan `seedCell` placement planner wired into producer/stash/craft/scheduled output flow.
