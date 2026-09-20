# Serakki architecture

This is the global map of implemented ownership and lifecycle. It keeps only cross-cutting invariants. Use [`DOMAIN_ATLAS.md`](DOMAIN_ATLAS.md) to find a domain and follow its local README for a dense island.

Gameplay meaning belongs to [`GAME.MD`](GAME.MD), portable authoring to [`CONFIG.md`](CONFIG.md), persisted compatibility to [`VERSION.md`](VERSION.md), and agent/code grammar to [`AGENTS.md`](AGENTS.md).

## Reading the architecture

Serakki's concrete module graph is acyclic and checked by [Dependency Cruiser](.dependency-cruiser.cjs). Its top-level domain graph is not a DAG: two domains may import different modules from each other without forming a module cycle.

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
| Editor persistence | Renderer products, filesystem Project Repository, MCP and Electron IPC cross through exact capability, transport and replacement lifecycles | [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md) |
| Acquisition and Estimate | Estimate and MCP consume the shared authored acquisition graph | [`src/estimate/README.md`](src/estimate/README.md) |

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
- Game Tick may orchestrate Job, Delivery and item-schedule lifecycle; those owners never import Tick clock, replay or loop.
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

`serakki-cli editor mcp` owns its filesystem repository, MCP server and optional ngrok tunnel directly inside the existing Node CLI root. It does not start or import an Electron runtime. The GUI Electron main composes the same Node-compatible capabilities independently.

Application Runtime also owns the renderer's one process-lifetime Atom registry/runtime bridge. It installs exact lower capabilities and never becomes a second source of their state. Ordinary components, callbacks and IPC handlers do not create private runtimes or Promise schedulers.

Each live Game owns one child Game Session runtime and Scope. HMR may restart application state; it is not an ownership handoff.

## Runtime

Serakki has three game forms:

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

Failure, interruption and an unchanged event-free result publish nothing. Successful Runtime becomes visible immediately; events describe that exact commit and never form another store. Nested Runtime reads during planning see the pinned pre-transition snapshot passed to the update, never a partially built candidate.

Subscribers own current-plus-tail observation. Runtime listeners ignore event-only transitions; event listeners receive later batches without historical replay. Slow callbacks may lag without delaying truth, Tick or save. Callback failure cannot roll back its commit, but enters the existing session fail-stop.

The complete mutation, Tick and session navigation is in [`src/game-runtime/README.md`](src/game-runtime/README.md). Gameplay semantics remain in [`GAME.MD`](GAME.MD).

## Session and installed Game

Game Session composes Runtime, Tick, save, command/listener scopes and first-failure publication. Playable Game adds resource URLs and presentation fail-stop without package identity. Game Incident records session transitions and failures for both Installed Game and Editor Board; only installed packages produce Serapack-backed incident archives. Installed Game adds Serapack/save bootstrap, resource leases and serialized package lifecycle.

Electron main inspects and hashes portable Serapacks as streams. First use extracts raw resource ranges into a content-hash installation; matching installations are reused optimistically without checking their extracted bodies. Renderer bootstrap receives config plus lazy same-origin `serakki://app/game/resource` URLs, never the archive or resource bytes. The protocol serves contained native files on demand and preserves byte ranges for media. Editor project resources use the sibling `serakki://app/editor/resource` boundary; Editor Serapack import reuses the same extraction boundary before publishing a portable source tree.

React mount state is never desired-Game state. Same-package acquisition shares one provisional lease; explicit load adopts it. A different package finalizes the current resource before acquisition.

Ordinary shutdown stops Tick, stops command producers, flushes or discards the latest stable Runtime as requested, then releases the owner scope with its subscriptions and runtime. Fatal quiesce closes transition subscriptions earlier. Concurrent cleanup joins the same attempt. A failed final save leaves the underlying Game Session frozen and capable of retry or explicit discard. Installed Game finalization treats that failure as terminal: its renderer authority retains one critical error and rejects successor acquisition rather than retrying. Reset and Editor replacement use discard-only disposal.

The Editor owns a separate revision-pinned `EditorBoardGameResource`. It uses the same gameplay surface without installed-package identity or autosave. Installed and Editor Games never share lifecycle ownership.

## Renderer

React owns routes, screen composition, forms, menus, modal state, command presentation and disposable projections. Feature Atoms own renderer commands whose admission/result must survive remounts. Route loaders and process services own lifecycle work; component effects do not.

React never owns gameplay, package/catalog, persistence or Game lifecycle truth. Native controls keep native state; other semantic visual state uses typed `data-ui-*` projection. Accessibility-only semantics and reduced-motion branches are outside Serakki's product contract.

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

Electron main owns native windows, protocols, privileged IPC and GUI-side filesystem composition. Node-compatible Project and MCP transport capabilities live under their semantic `src` owners, so the GUI and CLI may compose them without importing each other's process root. Renderer domains receive typed capabilities through `electron/contract`; native objects and managed project-internal paths never cross it. A user-selected Resource source crosses only as Electron's native path identity so main can copy it without transporting its bytes.

Development admits only the configured loopback Vite origin. Packaged builds admit only `serakki://app/*`. Navigation, frames, popups, permissions, CSP and privileged channels fail closed. HTTP(S) links requesting a new window from the trusted renderer open in the system browser; Electron popups remain denied, as do other URL schemes and URLs containing credentials. IPC validates the registered Serakki `webContents`, exact main frame and current trusted URL; an ID alone is not authorization.

## Persistence and Editor

Serakki-owned data is resolved independently from Electron below the effective system user's home:

```text
~/.serakki/diagnostics/  application logs
~/.serakki/game/         Serapacks, content-hash installations, saves, preferences, latest incident
~/.serakki/editor/       project catalog, managed projects, MCP state
```

`src/application-data` is the only owner of that root and complete path tree. Electron's `userData` remains private Chromium storage and is never an Serakki persistence root.

Game Persistence observes changed Runtime root identity, debounces and always flushes the latest canonical snapshot. Event-only transitions do not wake it. Persistence is an observer, not gameplay truth.

The Editor's portable current tree is canonical. The GUI Electron main and Node CLI alternatively compose the same filesystem Project Repository; renderer project state, forms, versioned Resource URLs, Build descriptors and Editor Board are projections. Project writes validate expected revision and apply one ordered best-effort file plan while preserving `.git` and unrelated files; there is no journal or aggregate rollback.

External authored JSON and Resource catalog changes are ignored while mounted. Project projections hold resource metadata, never binary bodies; item/config saves write only changed JSON and the revision marker. Requested image and music previews stream current files from their registered native paths; Music may request byte ranges. Already mounted images, audio and Editor Board are not watched. Explicit Refresh settles writes, discards drafts and Editor Board, rereads the directory metadata and publishes one replacement. There is no watcher, merge, repair mode, partial load or second project store. MCP uses the same repository, schemas and revision checks.

The GUI Editor and `serakki-cli editor mcp` are alternative owners of that repository. Running them concurrently is unsupported by contract and is neither detected nor prevented.

Gameplay version is output metadata stored as `{ major, minor, suffix? }` in `game.json`. Build remembers valid settings before compilation without advancing authoring revision or publishing a Board change; failed compilation retains those settings. The produced artifact owns the formatted version used by install compatibility. Ordinary content writes preserve output metadata and retain their normal revision boundary.

Editor Build and CLI pack compile the current saved source tree under the project write lock and stream PNG sources into the artifact. PNG bodies never enter the mounted authoring projection. There is no internal VCS, committed HEAD, object store, or persisted Board scenario. `src/editor-board` owns the ephemeral routed Board session; refresh, disposal and revision synchronization remain independent of Serapack version. See [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md).

## Hosted validation and delivery

[`Argcfile.sh`](Argcfile.sh) owns every repository and packaging command. Working branches run the complete `argc check` once on hosted Linux. macOS and Windows run `argc platform-check` for production build and real filesystem, Electron, Serapack, source and schema-writer portability.

Prerelease tags repeat those gates before delivery; stable tags deliberately skip them. Both build and sign one canonical Serapack, byte-compare it across native packages and publish the same standalone artifact. Production packages omit source maps; incident diagnostics and exact replay are the supported debugging surface.
