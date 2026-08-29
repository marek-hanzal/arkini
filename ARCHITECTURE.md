# Arkini architecture

This is the canonical map of implemented ownership and lifecycle. It does not catalog routes, fields, UI tuning, or future work. Gameplay meaning belongs to [`GAME.MD`](GAME.MD), authoring to [`CONFIG.md`](CONFIG.md), and persisted-format compatibility to [`VERSION.md`](VERSION.md).

## Dependency and process boundaries

The renderer dependency DAG is:

```text
src/@routes → { src/ui, src/renderer, exact src/engine owners, src/editor, electron/contract }
src/ui      → { src/renderer, exact src/engine owners, src/editor, electron/contract }
src/renderer → { exact src/engine owners, src/editor, electron/contract }
src/editor  → exact src/engine owners
```

- `src/engine` is framework-neutral gameplay, config, compiler, validation, pack, and CLI domain code. Consumers import exact Engine owners directly; there is no generic public/internal wall. Dependency Cruiser restricts only specifically enumerated mutable or raw authorities.
- `src/editor` is the platform-neutral Editor domain.
- `src/renderer` contains only concrete renderer-process runtime, lifecycle, concurrency, and transport capabilities. It is not a required gateway to Engine, Editor, or `electron/contract`; callers import the exact owner directly.
- `src/ui` owns reusable presentation and transient interaction. `src/@routes` owns registration, loaders, redirects, route context, and route-specific composition; routes may share only explicitly ignored `-*` route-private helpers, never import another route module.
- `electron/main` owns physical desktop capabilities and composes engine/editor owners directly. It never imports renderer code; concrete raw Engine authorities remain limited to their exact owners by Dependency Cruiser. `electron/preload` is transport-only; engine/editor code never imports Electron.

[`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) is the executable import-boundary authority. Do not duplicate those rules in tests or prose.

Within an exact domain owner, `fn/` contains only total synchronous explicit-input data-to-data operations named `*Fn` and their operation-owned co-located Props, Result, or other type declarations. It never contains Effect programs or standalone/declaration-only concepts such as schemas, standalone types, Context/Layer/errors, capabilities, or constant-only modules, and never replaces domain ownership with a global shared layer. One Fn and its owned declarations remain one exported concept. Fn composes only Fn, while Fx may compose Fn or Fx, so value dependencies cannot reach into effects or stateful capabilities.

Each physical process has one Effect execution root:

```text
Electron main → ElectronMainRuntime
renderer      → RendererRuntime
product CLI   → NodeRuntime.runMain
```

The renderer also has one process-lifetime Atom registry/runtime for React-visible Effect state. It does not duplicate `RendererRuntime` services. Each live game owns one child session `ManagedRuntime` and Scope containing engine services, Tick, subscriptions, commands, and cleanup. Ordinary callbacks, components, and IPC handlers must not create additional runtimes or private Promise schedulers. HMR may restart application state; it is not an ownership handoff.

## Canonical game truth

Arkini has three forms:

```text
GameConfig → validated static definition
Runtime    → live gameplay snapshot
State      → serializable gameplay state
```

One `SubscriptionRef<CommittedTransition>` owns the current runtime, mutation serialization, and gap-free publication:

```text
CommittedTransition { sequence, previousRuntime, runtime, events }
```

`runtime` is current gameplay truth. The monotonic `sequence`, bounded previous snapshot, and events belong to that exact commit and let consumers order and compare presentation without maintaining another writable Runtime.

Every production write enters `modifyRuntimeFx`:

```text
resolve live facts inside the write boundary
→ plan against one pinned snapshot
→ build an immutable candidate
→ validate the complete candidate
→ commit runtime and its events once
```

Waiting and planning remain interruptible. Failure, defect, interruption, or an unchanged event-free result commits and publishes nothing. A successful transition makes runtime truth visible immediately; events describe that same commit and are never a second store.

Independent commands may run concurrently until their short mutation-planning section. Do not add an outer command queue, second semaphore, second current-value/sequence authority, event bus, deep-clone layer, or event-derived read model.

Subscribers own current-plus-tail observation. Runtime listeners ignore event-only transitions; event listeners receive only later batches, never historical replay. Slow or failing external callbacks are isolated and may lag without delaying engine truth, Tick, save, or other listeners.

[`GAME.MD`](GAME.MD) owns Tick, queues, inputs, charges, placement, merge, and other gameplay semantics.

## Game and session ownership

`GameSession` owns one canonical Runtime, Tick fibers, command/listener scopes, and save lifecycle. The renderer-process playable `Game` adds its completed config and resource URLs without mirroring Runtime. UI executes exact Engine-owned Effects and reads the exact session snapshot through its concrete game capability.

`RendererRuntime` contains one scoped installed-game resource service. Acquisition uses scoped leases: same-package callers share one provisional result, the explicit load action adopts that exact lease, and `/game/$packageId` exposes only the adopted matching package through route context. A different package must finalize the current resource before acquisition. React mount/unmount is never desired-game state.

Installed-game release, reset, failed-save recovery, bootstrap failure, controlled close, and service shutdown are serialized by that single owner. Ordinary release saves and disposes before publishing Idle. Reset discards without a final save, clears only the verified exact save, then allows fresh acquisition. A critical cleanup/ownership failure retains the exact resource as unusable and replaces gameplay with the root fatal boundary; Board cannot remount over it.

Native close claims a pending or active installed resource through the same service. With a game, `/game/$packageId/action/exit` owns one best-effort final save/disposal and reports completion to Electron after its terminal presentation settles; without a game, close acknowledges directly. Force close is process policy and never pretends cleanup or save succeeded.

The Editor has a separate process-owned, revision-pinned `EditorBoardGameResource`. It runs the same canonical gameplay surface without an Arkpack identity or autosave. Project publication, refresh, scenario restore, and route release discard the prior session before publishing a replacement. Installed and Editor games never share lifecycle ownership.

Shutdown order for a session is: reject commands, stop Tick, close session scopes, flush the latest stable Runtime when applicable, then dispose its runtime. Concurrent cleanup callers join the same attempt. A failed ordinary final save freezes the session for an explicit retry; destructive reset/editor replacement uses discard-only disposal.

## Renderer ownership

React owns routes, route-specific screen composition, forms, menus, modal state, command presentation, and disposable projections. Feature-owned Effect Atoms own asynchronous renderer commands when admission/result must survive React remounts; lifecycle operations belong to route loaders or process services, not component effects. React may never own gameplay snapshots, package/catalog truth, persistence truth, or Game lifecycle.

Pixi owns retained Board, Toolbar, and Inventory scene presentation: display objects, geometry, hit testing, z-order, pointer lifecycle, and demand rendering. Motion is the only interpolation clock. The engine still decides every action and drop outcome. Main and Inventory canvases have separate actor stores; their handoff carries presentation geometry only and cannot assert runtime identity continuity. See the local [`src/ui/pixi/README.md`](src/ui/pixi/README.md).

Runtime commits immediately. Animation and audio may lag, redirect, collapse, or skip; they consume snapshots/events and never gate gameplay, Tick, publication, or save. Presentation state dies with its route, scene, or exact game owner.

The router uses standard history routing in development and packaged Electron. `/` owns renderer-session bootstrap; launcher routes never create a Game; the game parent owns the installed resource; blocking load/leave/reset/recovery/exit operations are explicit action leaves. Pending/error components render complete states but do not orchestrate domains.

## Electron and security

Electron main is the desktop application's only filesystem, native-window, protocol, MCP transport, and privileged IPC owner. Renderer domains see typed capabilities through `electron/contract`; physical paths and native objects never cross that seam. The product CLI is a separate Node process owner that receives filesystem services at its one runtime root.

Development admits only the configured loopback Vite origin. Packaged builds ignore development overrides and admit only `arkini://app/*`. Navigation, frames, popups, permissions, CSP, and every privileged channel are fail-closed. IPC validates the registered Arkini `webContents`, exact main frame, and current trusted URL; an ID alone is not authorization.

The Editor ChatGPT page is the one deliberate foreign surface. Electron owns a separate sandboxed, Node-free `WebContentsView` with no preload or Arkini IPC authority. It allows only bounded HTTPS navigation needed by that surface. Downloaded PNG candidates remain temporary until canonical validation and explicit revision-pinned insertion; rejection/discard writes no project state.

## Filesystem and persistence

The Node-only `FilesystemWrite` capability is the shared mechanical boundary for Electron, Editor, CLI, saves, and Arkpack publication. Readers and writers use the same canonical per-owner lock. A single owned file is replaced through one exact sibling staging file: sync the staged contents, atomically rename over the target without a delete fallback, then clean only that staging path. The portable Editor current tree is the only multi-file transaction; its rollback journal preserves old-or-new tree semantics for ordinary commits and Version checkout. Tree recovery distinguishes absent, owned, and unowned paths; confirmed symlink, containment, target-type, or missing-artifact ambiguity fails closed. Domain owners still serialize, validate, and map their own errors.

Electron user data is split by owner:

```text
<userData>/arkini/game/    Arkpacks, saves, preferences, logs
<userData>/arkini/editor/  project catalog, managed projects, MCP state
```

The package catalog combines bundled and user candidates. A valid user package may override the same package ID; an invalid one falls back to the bundled candidate. Package removal touches only the user package, never its save. Exact load independently verifies filename/package identity, the self-contained envelope, compatibility, config, resources, and soft provenance. Provenance trust is owned by the reading build's configured issuer/repository/workflow distribution channel, not its application version or the signing tag. [`VERSION.md`](VERSION.md) owns external envelopes and Official/Community provenance.

Autosave observes changed Runtime root identity, debounces, serializes writes, and always flushes the latest canonical snapshot. Event-only transitions do not wake or postpone it. Persistence is an observer, not gameplay truth.

## Editor authority

One Electron-main Effect repository owns each portable project directory. The current tree is canonical; renderer context, Atoms, form drafts, object URLs, build descriptors, and Editor Board are projections. [`CONFIG.md`](CONFIG.md) owns the exact portable layout.

The installation catalog stores only roots, managed/external ownership, and discovery metadata; project identity comes from validated `game.json`. Startup reconciles direct managed directories without deleting unlisted roots. Invalid cataloged projects remain independently visible and blocked with their concrete error. External projects are edited in place and deletion only unregisters them; managed deletion is explicit and may remove its owned directory.

Project mutations share `editor.lock`, validate the expected revision, and replace only Arkini-owned paths, preserving `.git` and unrelated files. External changes are ignored while mounted; explicit Refresh joins writes, discards drafts and the Editor Board, rereads the complete directory, and publishes one replacement. There is no watcher, merge, repair mode, partial load, or second project store.

Forms own local unsaved sessions. Save validates and publishes the complete owning entity; navigation outside a dirty session goes through one Save/Discard/Cancel guard. MCP mutations use the same schema, revision, reference checks, and filesystem repository. A successful external mutation emits a narrow invalidation; the renderer rereads canonical disk state.

Build validates the current disk revision, compiles through the canonical project pipeline, and atomically publishes one Community Arkpack descriptor. Save As/Install reread exact bounded artifact bytes; renderer memory is not an artifact store. The optional embedded release proof never changes the inner gameplay `contentHash`. JSON export creates a new unique owned child, copies only portable allowlisted paths, validates it, and never replaces an existing destination.

Versions are full immutable logical snapshots backed by content-addressed objects; `versions/head.json` publishes visibility last. Checkout replaces the current tree, scenarios, and head atomically while Notes remain outside Versions. Scenarios are explicit versioned State snapshots, never autosave. Estimate is a disposable approximation over the authored acquisition graph: it expands from authored starting facts, records the first locally ranked route when each fact becomes reachable using scalar action time with stable identity as the tie-break, divides demand by scalar expected yield, and times the materialized witness as an optimistic parallel critical path. Route admission proves one scalar output unit; larger propagated demand may return partial without retrying quantity-specific alternatives. Equivalent independent route occurrences are compressed with an explicit count. It diagnoses cycles or dead ends, but does not jointly account for shared outputs or finite-root consumption, does not simulate rules, capacity, placement, charges, or runtime execution, and is never an engine-valid witness. Its domain/data source owns query, filter, sort, and selection before React renders results. Flow is likewise an authored graph projection, not gameplay truth.

## Hosted validation and delivery

`Argcfile.sh` owns every repository and packaging command; GitHub workflows only install the pinned toolchain and invoke those commands. Working branches run the complete repository gate once on hosted Linux. macOS and Windows run the focused platform boundary gate: the production build, explicit Community Arkpack verification, and real filesystem, Electron, pack, source, and schema-writer tests. Pure engine, domain, and UI behavior is not repeated per operating system. `main` is the intentional passive escape hatch. Prerelease tags repeat those gates before delivery; stable tags deliberately skip them. Both tag channels then build and sign one canonical Arkpack before macOS arm64, Windows x64, Linux x64, and Linux arm64 jobs embed and byte-compare that same file. Both publish a GitHub Release containing those native packages and the same standalone Arkpack; prerelease tags mark it as a prerelease.
