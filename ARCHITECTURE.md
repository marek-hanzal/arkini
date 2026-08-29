# Arkini architecture

This is the canonical map of implemented ownership and lifecycle. It does not catalog routes, fields, UI tuning, or future work. Gameplay meaning belongs to [`GAME.MD`](GAME.MD), authoring to [`CONFIG.md`](CONFIG.md), and persisted-format compatibility to [`VERSION.md`](VERSION.md).

## Dependency and process boundaries

The product dependency map is:

```text
src/@routes → { exact product owners, src/ui, src/renderer, exact gameplay owners, electron/contract }
product presentation/workers → { exact product runtime/core owners, exact shared UI owners, exact gameplay owners, src/renderer, electron/contract }
authoring-shell → { authoring-session, exact authoring products, src/ui, src/renderer, electron/contract }
authoring-session → { project-authoring repository runtime, Board session, src/renderer, electron/contract }
src/arkpack/renderer → { src/arkpack/artifact, src/game-config, exact src/renderer owners, electron/contract }
src/editor-build/renderer → { src/editor-build/domain, exact src/arkpack owners, electron/contract }
src/arkpack/artifact → { src/game-config, exact filesystem/version owners in src/engine }
src/editor-build/domain → { Arkpack descriptor/version contracts, game diagnostics, Project Authoring repository failure contract }
project-authoring repository runtime → { Project Authoring core, src/game-config, electron/contract }
src/asset-authoring/ui → { Asset Authoring session/validation/domain, authoring-session, src/ui, src/renderer }
src/asset-authoring/session → { Asset Authoring validation, Project Authoring repository runtime, authoring-session, src/arkpack/renderer }
src/asset-authoring/validation → { Asset Authoring domain, exact renderer PNG validation and Engine resource contracts }
authoring product cores → { exact upstream authoring/config/gameplay owners }
src/game-config → { src/item-definition, src/game-start, exact production/spatial schemas, authored-config value schemas in src/engine }
src/game-start → { src/item-location, src/item-placement, exact item/runtime and config-capability owners in src/engine }
src/asset-authoring/domain → { exact authored-config resource owners }
committed transition producers → src/game-event
src/game-event → { exact spatial/Engine value schemas, placement results and Runtime item projections }
src/item-location → { exact item/runtime/delivery schema owners }
src/item-placement → { src/game-event, src/item-location, exact item/runtime/output/job owners }
src/item-merge → { src/game-event, src/item-placement, src/item-location, exact item/runtime/output/job owners }
src/space-action → { src/game-event, src/item-location, src/production-action, src/production-input, exact item/runtime owners }
src/production-condition → exact query/runtime facts in src/engine
src/item-definition → { exact production/spatial schema leaves, immutable common value schemas in src/engine }
src/production-output → src/production-condition
src/production-action → { src/production-condition, src/production-input, src/production-output }
src/production-line → { src/production-action, src/production-condition, src/production-input, src/production-output }
src/production-delivery → { src/production-input, src/production-line }
src/production-input → { src/production-action, src/production-delivery, src/production-line }
src/production-job → { src/production-action, src/production-delivery, src/production-input, src/production-line, src/production-output }
```

- The production pipeline has explicit semantic roots. `src/production-condition` owns authored runtime condition evaluation. `src/production-output` owns output, drop, and roll contracts/resolution. `src/production-action` owns immediate action admission and charge settlement. `src/production-input` owns line-input contracts, material planning, buffering, autofill, withdrawal, and storage mutation. `src/production-line` owns line definitions, rule interpretation, reads, and run planning. `src/production-job` owns FIFO queue admission, active-job state, output-capacity reservation, start/completion/cancellation sequencing, and job checks. `src/production-delivery` owns outbound allocation, travel, validation, reconciliation, and settlement. These roots import one another only through the executable directions in Dependency Cruiser; callers import exact owners directly.
- `src/game-start` owns the public initial-state schemas, exact Board/Inventory/Toolbar placement planning, and the one atomic empty-runtime start transaction. Planning applies Board, then Inventory, then Toolbar entries through canonical placement against one evolving candidate and commits only the completely valid runtime.
- `src/game-event` owns the strict committed-event vocabulary, ordered transient batches, and exact projection of already-applied placement results. Events are downstream facts from one committed transition, never canonical Runtime or serializable State. The owner cannot reach writable Runtime/transition authority, State, Tick, save, production decisions, renderer lifecycle, presentation, routes, or Electron; producers and consumers import its exact schemas and operation directly.
- The Board spatial boundary also has explicit semantic roots. `src/item-location` owns grid coordinates and size, gameplay distance labels, every persisted runtime location, concrete cell identity/claims, scope permission, and cross-space Board rejection. `src/item-placement` owns placement schemas, Manhattan ordering, scope fallback, stack/spawn planning, global max-count admission, existing-item return, and immutable placement application. `src/item-merge` owns directional merge schemas, first-rule admission, deterministic randomness, source/target/return lifecycle, output placement, and the atomic public merge command. `src/space-action` owns authored Space items plus revision/location-safe charge settlement and current-space navigation. Among these roots, dependencies flow `item-merge → item-placement → item-location` and `space-action → item-location`.
- `src/item-definition` owns the immutable authored Item vocabulary: common and specialized Item schemas, canonical type identity, storage permission, bounded quantities, selectors, authored query shapes, and the independently shared total selection policies over explicit Item values. It may compose the exact `SpaceSchema`, merge, production-line, output, and distance schema leaves that appear in an Item definition, but never imports live Runtime reads, mutable commands, temporary expiry, placement/interaction execution, product UI, or platform ownership. `SpaceSchema` remains owned by `src/space-action`; game metadata remains with `src/game-config`, while toolbar size belongs to `src/item-location` beside the locations it bounds.
- Aggregate root dependencies may point both ways where schema leaves define persisted Runtime/Delivery state and operations consume those exact schemas, or where placement consumes Output/Job decisions whose public contracts contain placement policy. Those are explicit product compositions, not module cycles: schemas remain upstream from operations, callers import exact files, and Dependency Cruiser rejects every concrete circular import. No barrel, adapter, or forwarding layer hides the relationship.
- `src/engine` retains the framework-neutral live runtime/session, Tick, live item operations, runtime query execution, state, save, filesystem/version support, application CLI composition, and other untouched gameplay owners. It no longer owns authored Item definitions or selection policy, Game Start, committed Game Event semantics, the production pipeline, spatial locations, placement, merge, or Space actions, and it does not own authored Game source, compilation, Arkpack delivery, or Editor Build.
- `src/game-config` owns the complete authored-game pipeline: public completed/source schemas, canonical JSON source discovery and parsing, stable JSON Schema emission, diagnostics, semantic validation, resource identity/usage/rename behavior, and completed-config compilation. `source/` stays upstream of `validation/` and `compiler/`; validation never imports compilation. The root is platform-neutral and cannot import Arkpack, Editor Build, renderer, presentation, routes, or Electron.
- `src/arkpack` owns package delivery with explicit boundaries. `artifact/` owns exact bytes, envelope, compression, signing, provenance, trusted root, artifact schemas, and artifact CLI commands. `renderer/` owns package admission, catalog, fallback, storage contracts, and load/import lifecycle. `ui/` owns catalog and import presentation. Artifact code stays upstream of renderer and UI and never imports Editor Build.
- `src/editor-build` owns the Editor Build product independently of Project Authoring. `domain/` owns build descriptors, the Build repository capability, and install planning; `renderer/` owns the Electron proxy, exact Save request, and built-artifact admission into the Arkpack catalog; `ui/` owns Build command/diagnostic presentation. Electron main retains privileged build and filesystem publication; routes retain Build page composition.
- `src/asset-authoring` owns the Editor Assets product. `domain/` contains only platform-neutral delete/reference and imported-ID policy over the upstream `src/game-config/resource` contract; `validation/` owns renderer PNG/file admission; `session/` owns import, edit, save, delete, canonical repository mutation, and project publication; `ui/` owns catalog, detail/form presentation, object-URL lifecycle, and product controllers. The root is not a generic Resource layer and does not replace authored-config resource ownership.
- `src/item-authoring` owns authored Item forms, detail/list/delete policies, persistence commands, and Item-specific presentation. `src/flow` owns the canonical authored acquisition graph, global Flow projection, canvas, and layout worker. `src/estimate` owns static Estimate semantics, query/index projections, renderer cache, and estimate worker. Their `domain/` subtrees are platform-neutral and cannot import UI, renderer, routes, or Electron; their `ui/` and `worker/` subtrees own product-specific presentation and renderer execution boundaries.
- `src/project-authoring` owns the portable project model and repository contract, project configuration, catalog/welcome workflows, Arkpack-to-project import, and portable source export. `src/board-scenario`, `src/project-version`, and `src/project-note` independently own revision-pinned Board scenarios, the immutable version graph and checkout policies, and ordered Notes outside Versions.
- `src/authoring-session` owns the one mounted renderer project projection, publication, refresh/replacement ordering, and cross-product unsaved-change guard. `src/authoring-mcp` owns renderer-side MCP status, settings, and checkout presentation. `src/authoring-shell` owns only cross-product Editor shell and navigation composition.
- `src/renderer` contains only concrete renderer-process runtime, lifecycle, concurrency, and transport capabilities. It is not a required gateway to Engine, Editor, or `electron/contract`; callers import the exact owner directly.
- `src/ui` owns cross-product primitives and reusable presentation. Product-specific UI remains with its top-level product owner. `src/@routes` owns registration, loaders, redirects, route context, and route-specific composition; routes may share only explicitly ignored `-*` route-private helpers, never import another route module.
- `electron/main` owns physical desktop capabilities and composes exact product-domain, Project Authoring repository-contract, production, and Engine owners directly. It never imports renderer or product-presentation code; concrete raw gameplay authorities remain limited to their exact owners by Dependency Cruiser. `electron/preload` is transport-only; production, Engine, and product-domain code never import Electron.

[`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) is the executable import-boundary authority. `argc dc` cruises the complete `src`, `electron`, `shared`, `scripts`, and `test` roots plus standalone TypeScript configs, so every product root participates in cycle, resolution, dependency, and orphan checks. Do not duplicate those rules in tests or prose.

Within an exact domain owner, total synchronous explicit-input data-to-data helpers are named `*Fn` and remain private beside their owner by default. The suffix is the immediate guarantee that the helper is total, non-throwing, and free of Effect, Promise, ambient state, time, randomness, I/O, mutation, or stateful capabilities; it does not require another public module. An owner-local `fn/` is reserved for independently shared pure policies, algorithms, or calculations with their own public contract and their operation-owned declarations. It never contains Effect programs or standalone/declaration-only concepts such as schemas, standalone types, Context/Layer/errors, capabilities, or constant-only modules, and never replaces domain ownership with a global shared layer. Fn composes only Fn, while Fx may compose Fn or Fx, so value dependencies cannot reach into effects or stateful capabilities.

One cohesive public ownership boundary owns each module. Sole-owner helpers, commands, constants, and supporting types stay private with it even when that makes the owner longer; split by independently meaningful policy, lifecycle, capability, or contract rather than by line count. Public schema, typed-failure, Context/Layer/capability, Atom-state, worker, and framework-entrypoint identities remain standalone where their contract is real.

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

Subscribers own current-plus-tail observation. Runtime listeners ignore event-only transitions; event listeners receive only later batches, never historical replay. Slow external callbacks are isolated and may lag without delaying engine truth, Tick, save, or other listeners. A callback failure is observed independently after the triggering commit: it cannot roll back or stall that commit or peer delivery, but it enters the existing fatal session fail-stop.

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

One Electron-main Effect repository owns each portable project directory through the `src/project-authoring` repository contract. The current tree is canonical; `src/authoring-session`, form drafts, object URLs, build descriptors, and Editor Board are projections. [`CONFIG.md`](CONFIG.md) owns the exact portable layout.

The installation catalog stores only roots, managed/external ownership, and discovery metadata; project identity comes from validated `game.json`. Startup reconciles direct managed directories without deleting unlisted roots. Invalid cataloged projects remain independently visible and blocked with their concrete error. External projects are edited in place and deletion only unregisters them; managed deletion is explicit and may remove its owned directory.

Project mutations share `editor.lock`, validate the expected revision, and replace only Arkini-owned paths, preserving `.git` and unrelated files. External changes are ignored while mounted; explicit Refresh joins writes, discards drafts and the Editor Board, rereads the complete directory, and publishes one replacement. There is no watcher, merge, repair mode, partial load, or second project store.

Forms own local unsaved sessions. Save validates and publishes the complete owning entity; navigation outside a dirty session goes through one Save/Discard/Cancel guard. MCP mutations use the same schema, revision, reference checks, and filesystem repository. A successful external mutation emits a narrow invalidation; the renderer rereads canonical disk state.

Editor Build validates the current disk revision, compiles through the canonical `src/game-config` pipeline, and atomically publishes one Community descriptor owned by `src/editor-build/domain`. Electron main owns physical publication. Save As/Install reread exact bounded artifact bytes; renderer memory is not an artifact store, and installation enters through `src/editor-build/renderer` into the exact Arkpack catalog owner. `src/editor-build/ui` owns Build diagnostics and command presentation while source export remains an Editor project action. The optional embedded release proof never changes the inner gameplay `contentHash`. JSON export creates a new unique owned child, copies only portable allowlisted paths, validates it, and never replaces an existing destination.

Versions are full immutable logical snapshots backed by content-addressed objects; `versions/head.json` publishes visibility last. Checkout replaces the current tree, scenarios, and head atomically while Notes remain outside Versions. Scenarios are explicit versioned State snapshots, never autosave. Estimate is a disposable approximation over the authored acquisition graph: it expands from authored starting facts, records the first locally ranked route when each fact becomes reachable using scalar action time with stable identity as the tie-break, divides demand by scalar expected yield, and times the materialized witness as an optimistic parallel critical path. Route admission proves one scalar output unit; larger propagated demand may return partial without retrying quantity-specific alternatives. Equivalent independent route occurrences are compressed with an explicit count. It diagnoses cycles or dead ends, but does not jointly account for shared outputs or finite-root consumption, does not simulate rules, capacity, placement, charges, or runtime execution, and is never an engine-valid witness. Its domain/data source owns query, filter, sort, and selection before React renders results. Flow is likewise an authored graph projection, not gameplay truth.

## Hosted validation and delivery

`Argcfile.sh` owns every repository and packaging command; GitHub workflows only install the pinned toolchain and invoke those commands. Working branches run the complete repository gate once on hosted Linux. macOS and Windows run the focused platform boundary gate: the production build, explicit Community Arkpack verification, and real filesystem, Electron, Arkpack artifact, Game source, and schema-writer tests. Pure engine, domain, and UI behavior is not repeated per operating system. `main` is the intentional passive escape hatch. Prerelease tags repeat those gates before delivery; stable tags deliberately skip them. Both tag channels then build and sign one canonical Arkpack before macOS arm64, Windows x64, Linux x64, and Linux arm64 jobs embed and byte-compare that same file. Both publish a GitHub Release containing those native packages and the same standalone Arkpack; prerelease tags mark it as a prerelease.
