# Harden TileEngine public API

Status: DONE

## Goal

Make TileEngine a clean standalone package-like module with explicit public extension points for game-specific behavior.

## Current state

- TileEngine no longer imports Arkini-specific domains.
- A previous leak from `play` transition kinds was removed.
- Game-specific animation planning is outside TileEngine.

## Proposed work

- Add/clean public types for slot models, actor models, transition kinds, interaction callbacks, and optional injected hooks.
- Consider a `useTileEngineSomething` public hook API only when it stays generic.
- Add a README section documenting what TileEngine may and may not know.
- Grep/audit imports from `src/v0/tile-engine`.
- Keep Arkini-specific mapping in board/inventory/animation adapters.

## 2026-06-16 audit note

A small ownership leak was fixed: enter-motion schema data now lives in `src/v0/tile-engine/TileEnterMotionSchema.ts` instead of `src/v0/play/motion/EnterMotionSchema.ts`. `src/v0/tile-engine` currently imports only its own files plus generic UI helpers and external libraries. Keep this task open until the public API is documented as a package-like boundary, but do not reintroduce game-domain imports while doing that.

## Acceptance

- `src/v0/tile-engine` imports only React/Motion/shared generic utilities and its own files.
- Game-specific custom behavior is passed by props/hooks/adapters.
- TileEngine can be understood without reading Arkini economy logic.
- Typecheck and build pass.

## Watchouts

- Do not add `CommandVisualEventSchema` to TileEngine. That is game-level language.
- Do not add item/board/inventory IDs to generic engine types.


## 2026-06-16 result

- Added `src/v0/tile-engine/index.ts` as the public package-like barrel.
- Migrated board, inventory and play code to import TileEngine components, public types, timing and motion request APIs only from `~/v0/tile-engine`.
- Added the `tile-engine-public-api-only` Dependency Cruiser rule so code outside TileEngine cannot deep-import implementation files.
- Added `src/v0/tile-engine/README.md` documenting ownership, forbidden Arkini knowledge and public exports.
- Kept the motion request registry as a public adapter extension point, while `useTileEngineMotionRequests` and runtime hooks remain internal implementation details.
