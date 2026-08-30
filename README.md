# Arkini

<p align="center">
  <img src="game/arkini/resources/hero.png" alt="Arkini logo with winged unicorns and magical machinery" width="100%" />
</p>

Arkini is an offline Electron economy game built around merge, production, and a deterministic data-driven engine. Its Editor authors portable game projects, validates and packs them into Arkpacks, runs the real gameplay surface, and exposes authoring and analysis tools including MCP, Flow, Estimate, Versions, Notes, and Assets.

## Start here

Read the smallest entry point needed for the task:

| Task | Start at |
| --- | --- |
| Agent behavior, tests, review | [`AGENTS.md`](AGENTS.md) |
| Runtime, process, UI, Editor, persistence ownership | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Implemented gameplay semantics | [`GAME.MD`](GAME.MD) |
| Project layout, authoring, compiler, validation | [`CONFIG.md`](CONFIG.md) |
| Compatibility, external formats, Arkpack provenance | [`VERSION.md`](VERSION.md) |
| Pixi implementation navigation | [`src/ui/pixi/README.md`](src/ui/pixi/README.md) |

## Repository map

```text
src/game-runtime  canonical live Runtime schemas, validation, identity, reads and atomic publication
src/game-persistence  persisted State, hydration, save codecs, autosave and exact save transports
src/game-tick  fixed-step budgeting, replay, job/delivery/temporary advancement and scoped loop
src/item-interaction  optimistic drop reads, authoritative drop/write commands and ordinary click actions
src/engine    remaining session, query and platform-neutral support owners
src/game-start  initial-state schemas, exact placement planning and atomic runtime start
src/game-event  committed gameplay event schemas and exact downstream event projection
src/item-line-detail  line-detail reads, board/stored projections, inputs/outputs/autofill and Item Lines presentation
src/item-detail-frame  Item Detail target lifecycle, command settlement, reference navigation and frame presentation
src/tile-presentation  semantic tile actors, feedback, replacements and committed motion projection
src/tile-motion  retained tile-motion lanes, choreography, magnetic response and playback lifecycle
src/item-definition  immutable authored Item schemas, query/selector vocabulary and total selection policy
src/item-location  grid coordinates, distance, runtime locations, claims and cross-space identity
src/item-placement  scope-aware stack, spawn, output and existing-item placement
src/item-merge  directional merge contracts, admission and atomic source/target lifecycle
src/space-action  authored Space items and atomic activation/navigation
src/production-action  immediate action admission, rules and charge settlement
src/production-condition  authored runtime condition evaluation
src/production-input  line-input schemas, material planning and storage lifecycle
src/production-line  production-line definitions, rules, reads and run planning
src/production-output  output, drop and roll schemas plus resolution policy
src/production-job  queue admission, active-job lifecycle, capacity, completion and active-job presentation
src/production-delivery  outbound input delivery allocation, validation and settlement
src/game-config  authored config, source, diagnostics, validation, resources and compiler
src/arkpack   artifact bytes/provenance, renderer catalog/runtime and package UI
src/editor-build  Build contract, renderer admission and Build presentation
src/project-authoring  portable project model, repository contract, configuration and catalog workflows
src/board-scenario  revision-pinned Board scenario contracts, session lifecycle and controls
src/project-version  immutable version graph, compatibility policies and checkout workspace
src/project-note  ordered project Notes contracts and workspace
src/authoring-mcp  renderer-side MCP status, settings and checkout presentation
src/authoring-session  mounted project publication, refresh, replacement and unsaved-change authority
src/authoring-shell  cross-product Editor shell and navigation composition
src/asset-authoring  Asset catalog, validation, import/edit/delete sessions and product presentation
src/item-authoring  authored Item domain and product UI
src/flow      canonical authored acquisition graph and origin projection
src/flow-layout  Flow geometry, routing algorithms and worker lifecycle
src/flow-canvas  global Flow projection, painter policy and product UI
src/estimate  static Estimate domain, projections, cache and worker
src/application-diagnostics  shared renderer-side failure extraction, diagnostic normalization and transport policy
src/application-runtime  renderer process composition, Atom bridge and native lifecycle
src/renderer  installed Game, launcher/window, resource-validation and transport capabilities
src/ui        cross-product primitives plus retained React and Pixi scene execution
src/@routes   TanStack Router registration, lifecycle and route-specific composition
electron      pure transport contract plus main/preload/platform ownership
shared        immutable cross-process application metadata and hard limits only
game/arkini   official portable game project
test          focused behavioral feedback
```

The enforced dependency graph and process/runtime ownership live in [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs). Do not infer architecture from directory names alone.

## Setup and commands

[`mise.toml`](mise.toml) pins Node, npm, and [`argc`](https://github.com/sigoden/argc). [`Argcfile.sh`](Argcfile.sh) is the only repository command surface; `package.json` is dependency metadata, not a second task runner.

```bash
mise install
argc install
argc dev
argc check
```

Use `argc --help` for the current command list. Common focused commands are:

```bash
argc typecheck
argc dc
argc test [path ...]
argc build
argc platform-check
argc game:schema
argc dev-control
argc mcp-inspect
```

`argc dc` is the read-only dependency-topology gate over every active module root and standalone TypeScript config. `argc check` runs formatting, all TypeScript configurations, a production Electron build plus Community Arkpack packing and verification, that dependency gate, copy/paste detection, and the permanent Vitest suite. `argc platform-check` is the narrower hosted macOS/Windows portability gate: it runs that production build and the real filesystem, Electron, pack, source, and schema-writer suites. Use focused tests during implementation; `platform-check` does not replace the complete closing gate.

Arkini is Electron-only: there is no web target or browser-storage fallback. Development uses the Vite renderer; packaged builds serve the same history-routed application from `arkini://app/`. Disposable build output lives below `.out/`; the official project owns its ignored `game/arkini/build/` artifacts.

## Distribution

`argc preview-macos` launches an unpacked local arm64 app. The native package commands create unsigned macOS arm64, Windows x64, Linux x64, and Linux arm64 applications. GitHub exposes the SHA-256 digest of every published release asset. Working branches run the complete repository gate on hosted Linux and the focused platform boundary gate on macOS and Windows; every platform builds and explicitly verifies a Community Arkpack. `main` deliberately runs nothing. Prerelease tags repeat the same gates before packaging, while stable tags package without rerunning them; both publish a GitHub Release. Every tag build creates the official game Arkpack once, embeds a keyless Sigstore proof for the configured distribution channel, and reuses those exact self-contained `.arkpack` bytes in every native package and standalone release artifact. Local and Editor packs are Community. Official and Community are both playable; [`VERSION.md`](VERSION.md) owns the exact soft-provenance contract.
