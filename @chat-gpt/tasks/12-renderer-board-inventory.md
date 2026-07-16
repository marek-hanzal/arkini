# 12 — Renderer shell, board, and inventory

**Status:** Queued

## Goal

Create the active browser shell and render board/inventory directly from the canonical session snapshot through thin adapters.

## Historical oracle

- `src/_archive/app/` and `src/_archive/ui/`;
- `src/_archive/board/` and `src/_archive/inventory/`;
- generic geometry/pointer ideas from `src/_archive/tile-engine/`;
- browser reset/storage behavior where still relevant.

## Current engine facts

- `GameSession`, `useRuntimeSelector`, `useGameCommand`, and `useGameEvents` exist;
- no active browser entrypoint exists;
- UI may intentionally lag canonical runtime for animation;
- `nukeGameSessionFx` currently provides provisional dispose/delete/create sequencing, but it is not a safe final production reset owner because the complete transition is not shell-owned.

## Accepted hard-reset direction

Hard reset is application-root replacement, not an in-place engine mutation.

The browser shell must own one complete running application instance created by a plain factory/composition function. That root includes every lifecycle-bearing resource introduced by the shell, such as the game session, Tick ownership, autosave, subscriptions, Effect scopes, browser listeners, read-model adapters, and persistence wiring.

Initial startup and post-reset startup must use the same factory path:

```text
create application root
→ publish running root
```

Confirmed reset must be one shell-owned single-flight transition:

```text
dispose complete current root without final save
→ wait for in-flight persistence shutdown
→ delete persisted state
→ create a completely fresh root through the same factory
→ atomically publish the fresh root
```

Concurrent confirmed resets join the same transition and receive the same fresh root object or the same failure. The confirmation component may disappear after invocation without cancelling the already-owned reset.

Failure after disposal must produce a truthful shell recovery/error state. The shell must not resurrect or continue presenting the disposed root.

Do not introduce a class merely to model this ownership. Prefer explicit factory/composition functions plus closure-owned current/reset state at the shell boundary.

## Do not port

- runtime store mirrors;
- React-owned gameplay state;
- historical bridge-owned domain reads;
- cyclic TileEngine package topology;
- presentation state reconstructed into persistent gameplay truth;
- in-place engine/session reset;
- React-component-local reset ownership or disabled-button correctness;
- module-global reset maps/locks;
- a separate reset-only bootstrap path that diverges from initial application creation.

## Acceptance criteria

- browser entrypoint loads config/state and creates one session;
- board and inventory render canonical items;
- `useSyncExternalStore` remains the runtime subscription path;
- local UI state is limited to gesture, camera, panel, and animation state;
- resize/responsive geometry does not affect engine coordinates;
- persistence uses the current save boundary;
- one plain application factory creates the complete root for both initial startup and post-reset startup;
- confirmed hard reset replaces the complete application root outside the engine instead of reinitializing it in place;
- the complete dispose/delete/create/publish transition is single-flight and atomically publishes only a fully created fresh root;
- reset failure exposes a truthful shell recovery state and never returns a disposed or partially initialized root.

## Required tests

- session mount/dispose;
- initial board/inventory render;
- runtime update invalidation;
- event-only transition does not rerender runtime selectors;
- interaction smoke tests;
- responsive geometry and stable IDs;
- browser persistence restore;
- initial startup and reset use the same application-root factory;
- two concurrent confirmed resets dispose once, delete once, create once, publish once, and receive the exact same fresh root;
- joined callers share delete/create failures and no fresh root is fabricated;
- an already-started reset survives confirmation-component teardown;
- cancellation before invoking reset changes nothing.

## Historical cleanup on closeout

Remove old app bootstrap, board/inventory React runtime, storage adapter, and generic TileEngine code after animation task extracts remaining motion behavior.
