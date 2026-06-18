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

Start with `v0-stabilization-epic-2026-06-18.md`. T1 craft single-job invariant, T2 craft target replacement, T3 stash output atomicity/full-open policy, T4 effective upgrade/config validation, T5 product input scope hardening, T6 inventory stateless stack policy, T7 generated entity IDs and T8 event flow visual planner cleanup are done. Craft partial input/withdraw side quest is also done. Badge polish is deferred until the model stops quietly sharpening knives in the drawer.

## Deferred / historical notes

- `v0-effect-tick-engine-2026-06-17.md` and `v0-tick-engine-integration-readiness-2026-06-17.md` are historical architecture plans. The runtime engine path is now live.
- `v0-json-game-definition-plan-2026-06-17.md` is mostly implemented as the JSON package/compile/validate path; use it for rationale, not as a fresh TODO list.
- `v0-product-line-categories-2026-06-17.md` remains deferred until producer product-line UI actually needs authored grouping.
- `000-refactor-backlog/*` remains an epic-style backlog/archive. New small task logs can live directly in this folder when they are v0-specific.

## Selected next task

Recommended next coding task: continue manual/browser UI polish after `v0-ui-overhaul-foundation-2026-06-18.md`, then revisit board/inventory sizing with screenshots.

Reason: runtime/cache/event mental-load cleanup is done enough for now, and the first UI foundation pass removed the biggest layout/theme issues without touching gameplay. Visual tasks need actual browser inspection next because compilers have the artistic sense of wet cardboard.

## Planned next task

- Browser/manual UI pass: verify header removal, sheet sizing, board/inventory readability and action hit areas on a real viewport; tune sizes rather than guessing from code.

## Completed recent task

- `v0-ui-overhaul-foundation-2026-06-18.md`: first broad UI pass removed the unused top header, introduced light pink/violet tokens, lightened board/inventory/sheets/cards, enlarged withdraw actions and added useful `data-ui` anchors.
- `v0-runtime-reader-naming-hygiene-2026-06-18.md`: follow-up naming cleanup removed redundant `GameRuntime` prefixes from focused runtime reader files/functions; inside `play/runtime/readers`, names should be `readBoardView`, `readInventorySlot`, etc.
- `v0-runtime-reader-hygiene-2026-06-18.md`: raw subscription follow-up split the catch-all runtime reader file into focused reader modules, added direct board-item/inventory-slot/first-empty-cell raw readers, and gave root board/inventory hooks semantic equality so derived object churn does not force unrelated redraws.
- `v0-focused-runtime-subscriptions-2026-06-18.md`: raw subscription follow-up reduced broad board/inventory/config subscriptions in board/inventory surfaces and item detail; drop commits read latest raw snapshots instead of keeping unrelated render subscriptions alive.
- `v0-event-flow-visual-planner-2026-06-18.md`: T8 removed the separate `ActionVisualEvent` runtime dialect. `GameRuntimeVisualEffects` now maps engine `GameEvent[]` directly into `GameEngineVisualPlan` motion/transient instructions.
- `v0-inventory-stateless-stack-policy-2026-06-18.md`: inventory save slots now distinguish stateless stacks from preserved instances; stateful board items stash as one-slot instances, running jobs reject stash, and inventory placement consumes/returns instances without losing identity.
- `v0-generated-entity-ids-2026-06-18.md`: save-level ID counters are gone; runtime-created item/job/scheduled-event IDs use `genId`/cuid2 with domain prefixes, and tests capture generated IDs instead of expecting counter values.
- `v0-product-input-scope-hardening-2026-06-18.md`: product definitions and product input refs are now single-owner per producer/product line; effective `product.inputRef.set` prefixes cannot make refs shared, and config layering uses an explicit input-ref owner map.
- `v0-effective-upgrade-validation-2026-06-18.md`: `GameConfigSchema` now rejects effective upgrade prefixes that create zero/negative product duration, input quantities or producer queue size, and runtime config layering no longer clamps those mistakes.
- `v0-craft-partial-input-withdraw-2026-06-18.md`: craft targets now persist partial input progress, start only after stored inputs are complete, support pre-start single-unit withdraw through producer-style placement, and keep completion on the existing target replacement/crossfade path.
- `v0-stash-full-open-output-2026-06-18.md`: follow-up k T3: stash open rolls every remaining charge in one click, places the whole output batch sequentially/atomically, and fails without partial save mutation when the full batch does not fit.
- `v0-stash-atomic-output-2026-06-18.md`: stash open now applies output/depletion atomically, fails without save mutation when placement is unavailable, and removed scheduled board remove/replace plumbing.
- `v0-craft-target-replacement-2026-06-18.md`: craft completion now replaces the board target in-place with exactly one result item and removed the old craft output/return scheduled-spawn path.
- `v0-craft-replace-crossfade-2026-06-18.md` - follow-up k T2: craft replacement cross-fade přes TileEngine `replace-in` / `replace-out` motion a board transient starého itemu.
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
