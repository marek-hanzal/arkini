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
- `/game/$packageId` owns one stable Query-backed `GameEngineResource`; its private Effect semaphore serializes leave, reset, exit, and HMR lifecycle actions, while `/game/$packageId/board` is the explicit gameplay leaf.


## Accepted router and page boundary

The Electron renderer uses TanStack Router file-based routing:

```text
src/@routes
→ route registration plus beforeLoad/loader/redirect/context orchestration

src/page
→ route-level screen and layout composition

src/ui
→ reusable presentation and transient interaction

src/bridge
→ concrete live game/runtime/board adapters

src/engine
→ standalone game engine
```

Renderer dependencies form the DAG `@routes → {page, ui, bridge}`, `page → ui`, `ui → bridge`, and `bridge → engine`. Route modules may coordinate public bridge lifecycle operations but contain no gameplay implementation and never import the engine directly. `/game/$packageId` is the non-visual resource/layout boundary, `/game/$packageId/board` composes `GameShell`, and future `/dev/**` routes remain outside this scope.

The client uses standard history routing. Development Electron loads the renderer from Vite for HMR; packaged Electron serves the same route tree from `arkini://app/*` with protocol-owned SPA fallback. `file://`, hash routing, and a standalone web target are not supported application modes. Persistent package/save ownership is implemented through typed Electron filesystem repositories. In-memory adapters exist only as explicitly injected test doubles.

The launcher validates bundled Arkini and local uploads through the same arkpack decode/schema/semantic/resource boundary. Imported binaries persist separately from package-namespaced saves. `/game/$packageId` is a non-visual route resource boundary: `beforeLoad` obtains one exact `GameEngineResource` through `ensureQueryData`, the parent loader exposes its `Game` to UI, and `/game/$packageId/board` renders `GameShell`. Launcher navigation and package replacement pass through explicit action leaf loaders so final disposal/save completes before the resource query is removed.

## Accepted game-menu and hard-reset direction

The game-only main menu is mounted at the `GameShell` boundary rather than in the board, a route, or a global application store. Its React Context owns only synchronous visibility control and the shell-owned `Escape`/focus boundary. Ordinary Save remains a standalone TanStack mutation over the authoritative `Game`; Main Menu, reset, and exit navigate to explicit action leaf routes whose loaders own lifecycle work. TanStack Query tracks the stable identity of the route resource but never mirrors engine state.

Hard reset is complete `Game` replacement, not an in-place engine mutation:

```text
confirm in the menu
→ navigate to /game/$packageId/action/reset
→ discard the current Game without final save under the resource semaphore
→ clear only its exact package/content-hash save
→ remove the exact Query resource
→ redirect to /game/$packageId/board
→ create one fresh Game through the normal parent query factory
```

A failed reset keeps the action error page and exact resource available for retry; idempotent disposal/save clearing resumes safely without exposing the save key or introducing another reset scheduler.

Save and exit means controlled whole-application shutdown. The menu requests native close; preload navigates to `/game/$packageId/action/exit`, whose loader performs the authoritative final save/disposal. Failure retains the same frozen retryable resource and does not send `closeReady`. Ordinary launcher navigation uses the distinct `/game/$packageId/action/leave` leaf.

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
- explicit save uses one standalone TanStack mutation; safe route release, hard reset, and exit use named action leaf loaders connected directly to their native Fx operations;
- confirmed hard reset replaces the complete Game outside the engine instead of reinitializing it in place;
- reset retry relies on idempotent destructive operations, removes the exact resource only after its required phase succeeds, and creates the fresh root only through normal route entry;
- reset failure exposes a truthful action-page recovery state and never returns a disposed or partially initialized root as live gameplay context.

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
