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

### 1. Stabilization epic

Start with `v0-stabilization-epic-2026-06-18.md`. T1 craft single-job invariant is done. Current next coding task is T2 craft completion as target replacement/swap. Badge polish is deferred until the model stops quietly sharpening knives in the drawer.

## Deferred / historical notes

- `v0-effect-tick-engine-2026-06-17.md` and `v0-tick-engine-integration-readiness-2026-06-17.md` are historical architecture plans. The runtime engine path is now live.
- `v0-json-game-definition-plan-2026-06-17.md` is mostly implemented as the JSON package/compile/validate path; use it for rationale, not as a fresh TODO list.
- `v0-product-line-categories-2026-06-17.md` remains deferred until producer product-line UI actually needs authored grouping.
- `000-refactor-backlog/*` remains an epic-style backlog/archive. New small task logs can live directly in this folder when they are v0-specific.

## Selected next task

Recommended next coding task: **Stabilization epic T2: craft completion = target replacement**.

Reason: T1 now enforces one running craft job per board target. The next broken contract is completion: craft must replace/swap the original target into the result item in-place, not spawn output somewhere else while the target survives like a smug little duplication bug.

## Completed recent task

- `v0-craft-single-job-invariant-2026-06-18.md`: engine readiness/start and `GameSaveConfigSchema` now enforce max one running craft job per target item while allowing parallel craft on different targets.
- `v0-stabilization-epic-2026-06-18.md`: corrected stabilization epic from GameConfig/tick audit plus clarified craft/inventory/overlay/event-flow decisions.
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
