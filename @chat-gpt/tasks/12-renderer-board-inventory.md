# 12 — Renderer shell, board, and inventory

**Status:** Queued

## Goal

Create the active browser shell and render board/inventory directly from the canonical session snapshot through thin adapters.

## Historical oracle

- `src/v0/app/` and `src/v0/ui/`;
- `src/v0/board/` and `src/v0/inventory/`;
- generic geometry/pointer ideas from `src/v0/tile-engine/`;
- browser reset/storage behavior where still relevant.

## Current engine facts

- `GameSession`, `useRuntimeSelector`, `useGameCommand`, and `useGameEvents` exist;
- no active browser entrypoint exists;
- UI may intentionally lag canonical runtime for animation.

## Do not port

- runtime store mirrors;
- React-owned gameplay state;
- historical bridge-owned domain reads;
- cyclic TileEngine package topology;
- presentation state reconstructed into persistent gameplay truth.

## Acceptance criteria

- browser entrypoint loads config/state and creates one session;
- board and inventory render canonical items;
- `useSyncExternalStore` remains the runtime subscription path;
- local UI state is limited to gesture, camera, panel, and animation state;
- resize/responsive geometry does not affect engine coordinates;
- persistence and hard reset use the current save boundary.

## Required tests

- session mount/dispose;
- initial board/inventory render;
- runtime update invalidation;
- event-only transition does not rerender runtime selectors;
- interaction smoke tests;
- responsive geometry and stable IDs;
- browser persistence restore/reset.

## Historical cleanup on closeout

Remove old app bootstrap, board/inventory React runtime, storage adapter, and generic TileEngine code after animation task extracts remaining motion behavior.
