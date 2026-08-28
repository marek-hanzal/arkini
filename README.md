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
| Compatibility, external formats, Arkpack trust | [`VERSION.md`](VERSION.md) |
| Pixi implementation navigation | [`src/ui/pixi/README.md`](src/ui/pixi/README.md) |

## Repository map

```text
src/engine    framework-neutral gameplay, config, compiler, pack and domain operations
src/editor    platform-neutral Editor domain
src/bridge    renderer access to public engine/editor/Electron contracts
src/ui        reusable React and Pixi presentation
src/page      route-level visual composition
src/@routes   TanStack Router registration and route lifecycle orchestration
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
argc game:schema
argc dev-control
argc mcp-inspect
```

`argc check` runs formatting, all TypeScript configurations, a production Electron build plus official Arkpack packing, dependency rules, copy/paste detection, and the permanent Vitest suite. Use focused tests during implementation; run the full gate when the requested scope warrants it.

Arkini is Electron-only: there is no web target or browser-storage fallback. Development uses the Vite renderer; packaged builds serve the same history-routed application from `arkini://app/`. Disposable build output lives below `.out/`; the official project owns its ignored `game/arkini/build/` artifacts.

## Distribution

`argc preview-macos` launches an unpacked local arm64 app; `argc package-macos` creates the current unsigned macOS arm64 development artifacts. Tagged development releases may keyless-sign the official Arkpack through GitHub OIDC. Trust is a soft provenance label—both Trusted and External packages remain playable—and its exact contract lives in [`VERSION.md`](VERSION.md).
