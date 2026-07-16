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

- `bridge/game` owns `Game`, `GameSession`, `createGameFx`, public command/event adapters, and live replacement identity;
- `bridge/runtime/useRuntimeSelector` is the single React subscription path to canonical runtime;
- the generated TanStack Router tree exists; `/` selects bundled or persistent local Arkpacks and `/game/$packageId` loads the selected package, restores its save, and renders the first read-only board slice;
- `bridge/board/useBoard`, `ui/board`, and the headless `ui/tile` foundation exist;
- UI may intentionally lag visually during animation, but canonical truth remains the live runtime;
- `nukeGameSessionFx` currently provides provisional dispose/delete/create sequencing, but it is not a safe final production reset owner because the complete transition is not shell-owned.


## Accepted router and page boundary

The active browser uses TanStack Router file-based routing:

```text
src/@routes
→ thin route registrations only

src/page
→ route-level screen and layout composition

src/ui
→ reusable presentation and transient interaction

src/bridge
→ concrete live game/runtime/board adapters

src/engine
→ standalone game engine
```

Dependency direction is `@routes → page → ui → bridge → engine`. Route modules point to standalone page components and contain no gameplay, session, or game composition. The `/game` file route is a layout branch whose page composes `GameShell` with an `Outlet`; future `/dev/**` routes remain outside this shell.

The client uses standard browser history. Browser development uses Vite's HTTP SPA fallback; packaged Electron serves the same route tree from `arkini://app/*` with protocol-owned SPA fallback. `file://` and hash routing are not supported application modes. Persistent package/save ownership migrates from IndexedDB to typed Electron filesystem repositories under #226 and #217.

The launcher validates bundled Arkini and local uploads through the same arkpack decode/schema/semantic/resource boundary. Imported binaries persist separately from package-namespaced saves. `GameShell` creates one complete live `Game` for the selected package through `createGameFx`; future hard reset replaces this whole game instance inside the same shell, leaving the router, package catalog, and non-game branches alive.

## Accepted hard-reset direction

Hard reset is complete `Game` replacement, not an in-place engine mutation.

The browser shell must own one complete running `Game` created by a plain factory/composition function. That game root includes every lifecycle-bearing resource introduced by the shell, such as the game session, Tick ownership, autosave, subscriptions, Effect scopes, browser listeners, read-model adapters, and persistence wiring.

Initial startup and post-reset startup must use the same factory path:

```text
create Game
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
- a separate reset-only bootstrap path that diverges from initial game creation.

## Acceptance criteria

- root launcher lists bundled Arkini and persistent validated local packages;
- local upload validates before persistence and exact package selection survives refresh through the route;
- browser game entrypoint loads selected config/namespaced state and creates one session;
- board and inventory render canonical items;
- `useSyncExternalStore` remains the runtime subscription path;
- local UI state is limited to gesture, camera, panel, and animation state;
- resize/responsive geometry does not affect engine coordinates;
- persistence uses the current save boundary;
- one plain game factory creates the complete root for both initial startup and post-reset startup;
- confirmed hard reset replaces the complete Game outside the engine instead of reinitializing it in place;
- the complete dispose/delete/create/publish transition is single-flight and atomically publishes only a fully created fresh root;
- reset failure exposes a truthful shell recovery state and never returns a disposed or partially initialized root.

## Required tests

- session mount/dispose;
- initial board/inventory render;
- runtime update invalidation;
- event-only transition does not rerender runtime selectors;
- interaction smoke tests;
- responsive geometry and stable IDs;
- arkpack import/deduplication/reload and package-removal isolation;
- browser save persistence restore scoped to exact package identity/content;
- initial startup and reset use the same game factory;
- two concurrent confirmed resets dispose once, delete once, create once, publish once, and receive the exact same fresh root;
- joined callers share delete/create failures and no fresh root is fabricated;
- an already-started reset survives confirmation-component teardown;
- cancellation before invoking reset changes nothing.

## Historical cleanup on closeout

Remove old app bootstrap, board/inventory React runtime, storage adapter, and generic TileEngine code after animation task extracts remaining motion behavior.
