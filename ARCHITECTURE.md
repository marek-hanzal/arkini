# Arkini architecture

This is the global map of implemented ownership and lifecycle. It keeps only cross-cutting invariants. Use [`DOMAIN_ATLAS.md`](DOMAIN_ATLAS.md) to find a domain and follow its local README for a dense island.

Gameplay meaning belongs to [`GAME.MD`](GAME.MD), portable authoring to [`CONFIG.md`](CONFIG.md), persisted compatibility to [`VERSION.md`](VERSION.md), and agent/code grammar to [`AGENTS.md`](AGENTS.md).

## Reading the architecture

Arkini's concrete module graph is acyclic and checked by [Dependency Cruiser](.dependency-cruiser.cjs). Its top-level domain graph is not a DAG: two domains may import different modules from each other without forming a module cycle.

Use exact edge language:

| Edge | Meaning |
| --- | --- |
| behavior | Executes a function, Effect, service, Atom, component, or other live operation. |
| contract | Composes a runtime schema, error, constant, or other value-level contract. |
| type | TypeScript-erased capability or value shape. |

Do not infer `upstream` or `downstream` from directory names. Name the exact layer and operation. A schema back edge is not runtime behavior; a behavior back edge is real integration even when the module graph stays acyclic.

The important dense clusters are:

| Cluster | Shape | Local map |
| --- | --- | --- |
| Runtime and Production | Real behavior in both directions for aggregate validation/cleanup and canonical Runtime mutation | [`src/game-runtime/README.md`](src/game-runtime/README.md), [`src/production-line/README.md`](src/production-line/README.md) |
| Authored schemas | Game Value is foundational; Config, Item, Location and Production compose its scalar contracts | [`src/game-config/README.md`](src/game-config/README.md) |
| Retained scene | Game Scene executes Tile Motion/Interaction; their reverse edges are type-only. Game Shell and Game Scene also share one explicit UI behavior seam. | [`src/game-scene/README.md`](src/game-scene/README.md) |
| Editor persistence | Renderer products and Electron repository cross through exact capability, transport and replacement lifecycles | [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md) |
| Flow and Estimate | Analysis core flows one way from Estimate to Flow; presentation reuse adds wider top-level edges | [`src/estimate/README.md`](src/estimate/README.md) |

## Stable boundaries

Production code uses flat `src/<domain>/<grammar>/<owner>` topology. A deeper directory is a real ownership boundary, not visual filing. Routes, Electron process structure, CLI/worker entrypoints and static assets are the deliberate exceptions. Tests live only under `test/` and mirror the smallest useful production owner.

Semantic ownership is not access control. Import an exact well-designed owner directly when the dependency fits. Do not duplicate behavior or add barrels, forwarding APIs, adapters, registries, caches or umbrella roots to make the graph look cleaner.

The stable graph-wide constraints are:

- Non-UI code never imports a `ui/` module.
- Platform-neutral domains do not import Electron transport or process code.
- Renderer code may consume only the pure `electron/contract` seam, never Electron main/preload or the Electron package.
- Electron main may consume product contracts and platform-neutral behavior, never renderer presentation.
- `src/game-value` owns only immutable scalar schemas and imports no aggregate, runtime, authoring or platform owner.
- `src/filesystem-write` owns only mechanical lock/path/durable-write capability and imports no product consumer.
- `src/item-revision` stays upstream of Runtime and command owners except for its exact type-only Game Value ID contract.
- Game Tick may orchestrate Job, Delivery and temporary-item lifecycle; those owners never import Tick clock, replay or loop.
- Game Session stays package-independent; `installed-game → playable-game → game-session` is the live capability direction.
- Exact schemas stay upstream from operations inside a concrete module path even when the domain-level graph has a return edge.

The executable details are in [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs). Product meaning belongs here, in the smallest local map, or in the owning semantic contract; it is not mirrored into consumer allowlists.

## Process and runtime roots

Each physical process has one Effect execution root:

```text
Electron main → ElectronMainRuntime
renderer      → RendererRuntime
product CLI   → NodeRuntime.runMain
```

Application Runtime also owns the renderer's one process-lifetime Atom registry/runtime bridge. It installs exact lower capabilities and never becomes a second source of their state. Ordinary components, callbacks and IPC handlers do not create private runtimes or Promise schedulers.

Each live Game owns one child Game Session runtime and Scope. HMR may restart application state; it is not an ownership handoff.

## Runtime

Arkini has three game forms:

```text
GameConfig → validated static definition
Runtime    → canonical live gameplay snapshot
State      → serializable gameplay state
```

Game Runtime owns one `SubscriptionRef<CommittedTransition>`:

```text
CommittedTransition { sequence, previousRuntime, runtime, events }
```

Every production write enters the same transaction boundary:

```text
resolve live facts
→ plan against one pinned snapshot
→ build an immutable candidate
→ validate the complete candidate
→ commit Runtime and events once
```

Failure, interruption and an unchanged event-free result publish nothing. Successful Runtime becomes visible immediately; events describe that exact commit and never form another store. Nested Runtime reads during planning see the pinned snapshot.

Subscribers own current-plus-tail observation. Runtime listeners ignore event-only transitions; event listeners receive later batches without historical replay. Slow callbacks may lag without delaying truth, Tick or save. Callback failure cannot roll back its commit, but enters the existing session fail-stop.

The complete mutation, Tick and session navigation is in [`src/game-runtime/README.md`](src/game-runtime/README.md). Gameplay semantics remain in [`GAME.MD`](GAME.MD).

## Session and installed Game

Game Session composes Runtime, Tick, save, command/listener scopes and first-failure publication. Playable Game adds resource URLs and presentation fail-stop without package identity. Installed Game adds Arkpack/save bootstrap, diagnostics, resource leases and serialized package lifecycle.

React mount state is never desired-Game state. Same-package acquisition shares one provisional lease; explicit load adopts it. A different package finalizes the current resource before acquisition.

Ordinary shutdown stops Tick, stops command producers, flushes or discards the latest stable Runtime as requested, then releases the owner scope with its subscriptions and runtime. Fatal quiesce closes transition subscriptions earlier. Concurrent cleanup joins the same attempt. Failed ordinary final save freezes the resource for retry; reset and Editor replacement use discard-only disposal.

The Editor owns a separate revision-pinned `EditorBoardGameResource`. It uses the same gameplay surface without installed-package identity or autosave. Installed and Editor Games never share lifecycle ownership.

## Renderer

React owns routes, screen composition, forms, menus, modal state, command presentation and disposable projections. Feature Atoms own renderer commands whose admission/result must survive remounts. Route loaders and process services own lifecycle work; component effects do not.

React never owns gameplay, package/catalog, persistence or Game lifecycle truth. Native controls keep native state; other semantic visual state uses typed `data-ui-*` projection. Accessibility-only semantics and reduced-motion branches are outside Arkini's product contract.

Retained gameplay rendering is downstream:

```text
Runtime + committed events
→ Tile Presentation semantic facts
→ Tile Rendering actors/capabilities
→ Tile Motion choreography
→ Game Scene composition
```

Tile Interaction owns pointer gestures and submits exact Item Interaction commands. Runtime commits immediately; animation and audio may lag, redirect, collapse or skip without gating gameplay, Tick, publication or save. See [`src/game-scene/README.md`](src/game-scene/README.md).

The router uses history routing in development and packaged Electron. `/` owns renderer bootstrap; Launcher creates no Game; the Game parent owns the installed resource. Blocking load, leave, reset, recovery and exit operations are explicit action leaves.

## Electron and security

Electron main is the only filesystem, native-window, protocol, MCP transport and privileged IPC owner. Renderer domains receive typed capabilities through `electron/contract`; physical paths and native objects never cross it. The CLI is a separate Node process owner.

Development admits only the configured loopback Vite origin. Packaged builds admit only `arkini://app/*`. Navigation, frames, popups, permissions, CSP and privileged channels fail closed. IPC validates the registered Arkini `webContents`, exact main frame and current trusted URL; an ID alone is not authorization.

The Editor ChatGPT page is the one foreign surface. Electron owns its separate sandboxed, Node-free `WebContentsView` with no preload or Arkini IPC authority. Generated PNG bytes remain temporary until canonical validation and explicit revision-pinned insertion.

## Persistence and Editor

Electron user data is split by owner:

```text
<userData>/arkini/game/    Arkpacks, saves, preferences, logs, latest incident
<userData>/arkini/editor/  project catalog, managed projects, MCP state
```

Game Persistence observes changed Runtime root identity, debounces and always flushes the latest canonical snapshot. Event-only transitions do not wake it. Persistence is an observer, not gameplay truth.

The Editor's portable current tree is canonical. Electron main implements the Project Repository; renderer project state, forms, object URLs, Build descriptors and Editor Board are projections. Project writes validate expected revision and use one recoverable current-tree transaction while preserving `.git` and unrelated files.

External changes are ignored while mounted. Explicit Refresh settles writes, discards drafts and Editor Board, rereads the complete directory and publishes one replacement. There is no watcher, merge, repair mode, partial load or second project store. MCP uses the same repository, schemas and revision checks.

Versions are immutable complete logical snapshots; Notes stay outside them and Scenarios are included. See [`src/project-version/README.md`](src/project-version/README.md) and [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md).

## Hosted validation and delivery

[`Argcfile.sh`](Argcfile.sh) owns every repository and packaging command. Working branches run the complete `argc check` once on hosted Linux. macOS and Windows run `argc platform-check` for production build and real filesystem, Electron, Arkpack, source and schema-writer portability.

Prerelease tags repeat those gates before delivery; stable tags deliberately skip them. Both build and sign one canonical Arkpack, byte-compare it across native packages and publish the same standalone artifact. Production packages omit source maps; incident diagnostics and exact replay are the supported debugging surface.
