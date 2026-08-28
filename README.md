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
src/engine    framework-neutral gameplay, config, compiler, pack and domain operations
src/editor    platform-neutral Editor domain
src/bridge    renderer access to public engine/editor/Electron contracts
src/ui        reusable React and Pixi presentation
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
argc test [path ...]
argc build
argc platform-check
argc game:schema
argc dev-control
argc mcp-inspect
```

`argc check` runs formatting, all TypeScript configurations, a production Electron build plus Community Arkpack packing and verification, dependency rules, copy/paste detection, and the permanent Vitest suite. `argc platform-check` is the narrower hosted macOS/Windows portability gate: it runs that production build and the real filesystem, Electron, pack, source, and schema-writer suites. Use focused tests during implementation; `platform-check` does not replace the complete closing gate.

Arkini is Electron-only: there is no web target or browser-storage fallback. Development uses the Vite renderer; packaged builds serve the same history-routed application from `arkini://app/`. Disposable build output lives below `.out/`; the official project owns its ignored `game/arkini/build/` artifacts.

## Distribution

`argc preview-macos` launches an unpacked local arm64 app. The native package commands create unsigned macOS arm64, Windows x64, Linux x64, and Linux arm64 applications. GitHub exposes the SHA-256 digest of every published release asset. Working branches run the complete repository gate on hosted Linux and the focused platform boundary gate on macOS and Windows; every platform builds and explicitly verifies a Community Arkpack. `main` deliberately runs nothing. Prerelease tags repeat the same gates before packaging, while stable tags package without rerunning them; both publish a GitHub Release. Every tag build creates the official game Arkpack once, embeds a keyless Sigstore proof for the configured distribution channel, and reuses those exact self-contained `.arkpack` bytes in every native package and standalone release artifact. Local and Editor packs are Community. Official and Community are both playable; [`VERSION.md`](VERSION.md) owns the exact soft-provenance contract.
