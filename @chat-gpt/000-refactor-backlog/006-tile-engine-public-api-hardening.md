# Harden TileEngine public API

Status: TODO

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
- Grep/audit imports from `src/tile-engine`.
- Keep Arkini-specific mapping in board/inventory/animation adapters.

## Acceptance

- `src/tile-engine` imports only React/Motion/shared generic utilities and its own files.
- Game-specific custom behavior is passed by props/hooks/adapters.
- TileEngine can be understood without reading Arkini economy logic.
- Typecheck and build pass.

## Watchouts

- Do not add `CommandVisualEventSchema` to TileEngine. That is game-level language.
- Do not add item/board/inventory IDs to generic engine types.
