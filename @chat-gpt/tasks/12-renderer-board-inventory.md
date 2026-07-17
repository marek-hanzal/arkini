# 12 — Renderer shell, board, and inventory

**Status:** Active renderer foundation implemented; gameplay UI slices continue incrementally

## Goal

Create the active Electron renderer shell and render board/inventory directly from the canonical session snapshot through thin adapters.

## Historical oracle

- `src/_archive/app/` and `src/_archive/ui/`;
- `src/_archive/board/` and `src/_archive/inventory/`;
- generic geometry/pointer ideas from `src/_archive/tile-engine/`;
- Electron reset/storage behavior where still relevant.

## Current engine facts

- `bridge/game` owns `Game`, `GameSession`, `createGameFx`, public command/event adapters, and live replacement identity;
- `bridge/runtime/useRuntimeSelector` is the single React subscription path to canonical runtime;
- the generated TanStack Router tree exists; `/` selects bundled or persistent local Arkpacks and `/game/$packageId` loads the selected package, restores its save, and renders the first read-only board slice;
- `bridge/board/useBoard`, `ui/board`, and the headless `ui/tile` foundation exist;
- UI may intentionally lag visually during animation, but canonical truth remains the live runtime;
- the stable root `GameOwner` owns explicit package selection, route release, shutdown, hard reset, and save recovery under one Effect semaphore; no command Queue, latest-intent interpreter, captured runtime, or Promise scheduler remains.


## Accepted router and page boundary

The Electron renderer uses TanStack Router file-based routing:

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

The client uses standard history routing. Development Electron loads the renderer from Vite for HMR; packaged Electron serves the same route tree from `arkini://app/*` with protocol-owned SPA fallback. `file://`, hash routing, and a standalone web target are not supported application modes. Persistent package/save ownership is implemented through typed Electron filesystem repositories. In-memory adapters exist only as explicitly injected test doubles.

The launcher validates bundled Arkini and local uploads through the same arkpack decode/schema/semantic/resource boundary. Imported binaries persist separately from package-namespaced saves. The stable root `GameOwnerProvider` declaratively maps the current router branch to one serialized `GameOwner`; `GameShell` only renders the matching published package. Selection awaits final disposal/save, duplicate identical requests become no-ops, and an unpublished candidate is discarded without save. Route release, controlled shutdown, hard reset, and invalid-save recovery remain explicit operations with distinct failure semantics.

## Accepted game-menu and hard-reset direction

The game-only main menu is mounted at the `GameShell` boundary rather than in the board, a route, or a global application store. Its React Context owns only synchronous visibility control and the shell-owned `Escape`/focus boundary. Async Save, Save and exit, and Destroy actions are complete standalone TanStack mutation options connected directly to the authoritative `Game` / `GameOwner` Fx operations; TanStack tracks UI command state but never mirrors engine state.

Hard reset is complete `Game` replacement, not an in-place engine mutation:

```text
confirm in the menu
→ discard the current Game without final save
→ clear only its exact package/content-hash save
→ create and publish one fresh Game through the normal factory
→ close the old menu with the replaced game shell
```

`GameOwner` serializes each explicit lifecycle operation under one semaphore. The menu disables duplicate mutation execution rather than introducing another owner scheduler or a queued second reset. If hard reset fails after discard or save clearing, private owner recovery records the completed phase; retry continues from the remaining phase without repeating destructive work or exposing the save key to UI. A disposed game may remain only as exact mutation identity while the retry UI is mounted; it is never supplied through `GameProvider` as a live gameplay root.

Save and exit means controlled whole-application shutdown. The menu requests the trusted native close handshake; `GameOwner.shutdownFx` performs the authoritative final save before Electron closes. Failure rejects the same mutation, keeps the current retryable game and menu visible, and does not navigate. Ordinary non-game route ownership still uses the distinct `releaseRouteGameFx`.

## Do not port

- runtime store mirrors;
- React-owned gameplay state;
- historical bridge-owned domain reads;
- cyclic TileEngine package topology;
- presentation state reconstructed into persistent gameplay truth;
- in-place engine/session reset;
- React-component-local lifecycle semantics or a second reset scheduler;
- module-global reset maps/locks;
- a separate reset-only bootstrap path that diverges from initial game creation.

## Acceptance criteria

- root launcher lists bundled Arkini and persistent validated local packages;
- local upload validates before persistence and exact package selection survives refresh through the route;
- Electron renderer entrypoint loads selected config/namespaced state and creates one session;
- board and inventory render canonical items;
- `useSyncExternalStore` remains the runtime subscription path;
- local UI state is limited to gesture, camera, panel, and animation state;
- resize/responsive geometry does not affect engine coordinates;
- persistence uses the current save boundary;
- one plain game factory creates the complete root for both initial startup and post-reset startup;
- the game-shell menu opens only on active game routes, traps/restores focus, and never creates another engine pause model;
- explicit save, safe route release, and hard reset use complete standalone TanStack mutation contracts connected directly to their native Fx operations;
- confirmed hard reset replaces the complete Game outside the engine instead of reinitializing it in place;
- reset retry resumes after the last privately recorded successful destructive phase and atomically publishes only a fully created fresh root;
- reset failure exposes a truthful shell recovery state and never returns a disposed or partially initialized root as live gameplay context.

## Required tests

- session mount/dispose;
- initial board/inventory render;
- runtime update invalidation;
- event-only transition does not rerender runtime selectors;
- interaction smoke tests;
- responsive geometry and stable IDs;
- arkpack import/deduplication/reload and package-removal isolation;
- Electron save persistence restore scoped to exact package identity/content;
- initial startup and reset use the same game factory;
- Escape toggle, backdrop pointer ownership, focus trap, and focus restoration;
- Save disables overlapping menu actions and reports durable success/failure;
- Save and exit navigates only after successful safe route release and preserves retryable ownership on failure;
- Destroy requires confirmation, invokes canonical hard reset once, and keeps truthful retry state after discard/clear/create failure;
- hard-reset retry does not repeat already completed destructive phases;
- cancellation before invoking reset changes nothing.

## Historical cleanup on closeout

Remove old app bootstrap, board/inventory React runtime, storage adapter, and generic TileEngine code after animation task extracts remaining motion behavior.
