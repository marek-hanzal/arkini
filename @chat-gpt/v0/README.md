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

### 1. Badge/visual polish

Tile badge/level offset can be tightened toward the corner. Keep it tiny and do not redesign tile layout while pretending it is “just polish”.

## Deferred / historical notes

- `v0-effect-tick-engine-2026-06-17.md` and `v0-tick-engine-integration-readiness-2026-06-17.md` are historical architecture plans. The runtime engine path is now live.
- `v0-json-game-definition-plan-2026-06-17.md` is mostly implemented as the JSON package/compile/validate path; use it for rationale, not as a fresh TODO list.
- `v0-product-line-categories-2026-06-17.md` remains deferred until producer product-line UI actually needs authored grouping.
- `000-refactor-backlog/*` remains an epic-style backlog/archive. New small task logs can live directly in this folder when they are v0-specific.

## Selected next task

Recommended next coding task: **Badge/visual polish**.

Reason: tile level/badge placement is a small visual fix that was already called out and should be quick to close now that the larger inventory placement flow is done.

## Completed recent task

- `v0-inventory-seeded-placement-2026-06-18.md`: long press on empty board cell opens inventory with seeded Manhattan placement; selecting a stack places it through shared board-then-inventory planner semantics.
- `v0-board-dnd-confinement-2026-06-18.md`: board item DnD is confined to the board; inventory is no longer a board-item drop target and item detail owns explicit `Store` to inventory.
- `v0-touch-long-press-polish-2026-06-18.md`: native context/callout menus are suppressed on TileEngine game surfaces without adding global app-wide hijacking.
- `v0-product-line-input-withdraw-2026-06-18.md`: product-line input rows can withdraw their whole stored amount through producer-style board-then-inventory placement.
- `v0-product-line-input-refs-2026-06-18.md`: producer-level consumable inputs moved to standalone named input definitions referenced by product lines; line inputs fill through DnD and are stored under `save.producerInputs`.
- `v0-strict-gameconfig-merge-rules-2026-06-18.md`: merge execution is strictly source-owned by `GameConfig`; reverse runtime merge heuristics are removed.
- `v0-merge-executable-parity-2026-06-18.md`: historical note; superseded by strict source-owned merge rules.
- `v0-producer-board-progress-2026-06-18.md`: running producer jobs now show a subtle bottom progress bar on their board tile; future queue and blocked delivery are intentionally ignored.
- `v0-producer-blocked-delivery-2026-06-18.md`: producer output rolls once, blocked delivery persists on the job, retries without spam/reroll, keeps queue capacity occupied, and marks blocked producer tiles with a subtle danger frame.
- `v0-local-placement-planner-2026-06-18.md`: shared Manhattan `seedCell` placement planner wired into producer/stash/craft/scheduled output flow.
