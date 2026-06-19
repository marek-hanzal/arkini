# Audit domain Effect boundaries

Status: DONE

## Goal

Make sure domain logic lives in Effect-backed roots or small pure helpers, not in components or oversized hooks.

## Current state

- Command routing uses Effect.
- Many persistence/domain roots exist under feature `fx` folders.
- Some hooks still coordinate too much behavior.
- First slice moved board-item tap intent and inventory-slot tap intent from TileEngine adapter hooks into pure `logic/` helpers with tests.

## Audit checklist

- Components should not decide merge/feed/activation/craft eligibility.
- Hooks may compose Fx calls and UI state, but should not become domain engines.
- Domain Fx roots should return typed result schemas and visual events where relevant.
- Database writes should be inside transactions for all multi-step game changes.
- Shared helpers should be meaningful, not one-line shrine files.

## Acceptance

- Move remaining domain decisions out of UI components.
- Split only oversized hooks with multiple responsibilities.
- Keep one file per exported function/schema/type where practical.
- Typecheck and build pass.

## Watchouts

- Do not create abstract factories just to feel clever. Future us has enough enemies.

## 2026-06-16 slice

- Added `resolveBoardItemTapAction` so board tap policy chooses `claim-craft`, `activate`, or `none` outside `useBoardTileEngineModel`.
- Added `resolveInventorySlotTapAction` so inventory double-tap policy chooses board placement or inventory-slot feedback outside `useInventoryTileEngineModel`.
- Added focused tests for both helpers.

Remaining audit should look for larger hook-side orchestration, especially mutation hooks that mix domain follow-up decisions with UI/cache concerns.

## 2026-06-17 slice

- Added pure drop action resolvers for board-cell, inventory-cell and inventory-slot drops. `resolve*Drop` adapters now map action intents to TileEngine outcomes, mutations and feedback instead of mixing gameplay/drop policy with UI commit wiring.
- Added `resolveActivationDepletionFollowUp` so `useActivateBoardItemMutation` delegates delayed stash depletion follow-up timing/eligibility out of the hook.
- Added focused tests for the new drop action resolvers and activation depletion follow-up.

Remaining audit should continue with larger mutation/cache orchestration only if it shows real duplicated policy. Do not peel every adapter into ceremonial abstractions; the boundary goal is domain clarity, not file cosplay.

## 2026-06-17 final slice

- Moved optimistic board merge visual-event creation out of the cache patcher into `resolveOptimisticBoardMergeVisualEvent`, so the cache layer no longer resolves manifest merge rules directly.
- Moved inventory statefulness detection from cache helpers into `inventory/logic/isStatefulInventoryState`.
- Final audit found the remaining mutation hooks are mostly thin React Query shells: run Fx, apply optimistic cache patch where needed, restore snapshot on error, and apply action-result visual events on success. Larger DB/domain decisions stay in Fx roots or focused pure helpers.
- Marked the task done; future work should only extract new helpers when real duplicated policy appears, not because adapter glue exists and offends somebody's architecture cosplay budget.
