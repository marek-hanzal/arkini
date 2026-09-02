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
| Cross-cutting process, Runtime, UI, persistence and security invariants | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Find a domain, public entrypoint or dense local map | [`DOMAIN_ATLAS.md`](DOMAIN_ATLAS.md) |
| Implemented gameplay semantics | [`GAME.MD`](GAME.MD) |
| Project layout, authoring, compiler, validation | [`CONFIG.md`](CONFIG.md) |
| Compatibility, external formats, Arkpack provenance | [`VERSION.md`](VERSION.md) |

## Repository map

| Zone | Owns | Navigate from |
| --- | --- | --- |
| Gameplay state and execution | Runtime, Item/space commands, Tick, save and live Game lifecycle | [`src/game-runtime/README.md`](src/game-runtime/README.md) |
| Production | Conditions, actions, inputs, lines, jobs, delivery and output | [`src/production-line/README.md`](src/production-line/README.md) |
| Retained gameplay presentation | Tile projection/rendering/motion/interaction and concrete scenes | [`src/game-scene/README.md`](src/game-scene/README.md) |
| Authored source | Foundational values, completed Config, source files, resources, diagnostics, validation and compiler | [`src/game-config/README.md`](src/game-config/README.md) |
| Artifacts and compatibility | Arkpack admission/artifact/catalog, saves and release provenance | [`VERSION.md`](VERSION.md) |
| Editor persistence | Portable repository, renderer project session, IPC, Scenarios, Notes and Build | [`electron/main/editor-project/README.md`](electron/main/editor-project/README.md) |
| Versions | Immutable project snapshots, commit compatibility, saved-HEAD proof and checkout | [`src/project-version/README.md`](src/project-version/README.md) |
| Flow and Estimate | Authored acquisition graph, layout, Canvas and static optimistic analysis | [`src/estimate/README.md`](src/estimate/README.md) |
| Application and platform | Launcher, renderer runtime/shell/settings, routes and Electron | [`ARCHITECTURE.md`](ARCHITECTURE.md) |

For an exact domain role and first public entrypoint, search [`DOMAIN_ATLAS.md`](DOMAIN_ATLAS.md). Directory grammar identifies the code layer; source imports and Dependency Cruiser identify the concrete graph; the owning contract identifies meaning.

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
argc translations:sync
argc translations:check
argc dev-control
argc mcp-inspect
```

`argc translations:sync` reconciles every `src/translation/*.yaml` catalog. It extracts configured literal keys, adds missing entries, removes dead static entries, preserves explicit dynamic entries, and sorts the result. `argc translations:check` performs the same work without writing and fails on drift. The renderer bundles those catalogs, negotiates against Electron's preferred languages, and falls back to `en`; there is no generated copy or runtime download.

`argc dc` checks dependency topology across every active module root and standalone TypeScript config. `argc check` runs formatting and translation drift, all TypeScript configurations, a production Electron build, Community Arkpack packing and verification, dependency checks, copy/paste detection, and the permanent Vitest suite.

`argc platform-check` is the narrower hosted macOS/Windows portability gate. It runs the production build plus real filesystem, Electron, pack, source, and schema-writer suites. Use focused tests during implementation; this does not replace the complete closing gate.

Arkini is Electron-only: there is no web target or browser-storage fallback. Development uses the Vite renderer; packaged builds serve the same history-routed application from `arkini://app/`. Disposable build output lives below `.out/`; the official project owns its ignored `game/arkini/build/` artifacts.

The installed macOS CLI can run one Editor project's configured MCP server without opening the Editor:

```bash
arkini-cli editor mcp <projectId>
arkini-cli editor mcp <projectId> --remote
```

Local MCP always starts on the port saved by the Editor. `--remote` additionally starts its saved ngrok tunnel. Running the GUI Editor and this command at the same time is unsupported and is not actively prevented.

## Distribution

`argc preview-macos` launches an unpacked local arm64 app. Native package commands create unsigned macOS arm64, Windows x64, Linux x64, and Linux arm64 applications. GitHub exposes the SHA-256 digest of every published release asset.

Working branches run the complete repository gate on hosted Linux and the focused platform gate on macOS and Windows; every platform builds and verifies a Community Arkpack. `main` deliberately runs nothing. Prerelease tags repeat those gates before packaging, while stable tags package without rerunning them; both publish a GitHub Release.

Every tag build creates the official Arkpack once, embeds a keyless Sigstore proof for the configured distribution channel, and reuses the exact self-contained bytes in every native package and standalone release artifact. Local and Editor packs are Community. Both states are playable; [`VERSION.md`](VERSION.md) owns soft provenance.
