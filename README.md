# Arkini

<p align="center">
  <img src="game/arkini/resources/hero.png" alt="Arkini logo with winged unicorns and magical machinery" width="100%" />
</p>

Arkini is a client-only, offline merge and production game built around a deterministic, data-driven engine. The current runtime slice backs production lines, jobs, queueing, output rolls, placement, directional merge, finite lifetime and charges, utility controls, state, save, and session boundaries. [`CONFIG.md`](CONFIG.md) and [`GAME.MD`](GAME.MD) define the exact authoring and gameplay contracts. The repository is intentionally maintained with an LLM as the primary implementer, so documentation is part of the correctness boundary rather than decorative prose that slowly becomes compost.

**Product direction:** Marek

**Architecture, implementation, and documentation:** GPT-5.6 Thinking, professionally harassed into precision by Marek

## Current status

The engine, compiler, validator, binary packer, deterministic Tick model, runtime session speed control, jobs, queueing, reservations, placement, persistence boundary, and live React bridge are implemented and covered by the repository check gate.

The client uses [TanStack Router](https://tanstack.com/router/latest/docs/overview) file-based routing. `/` owns a one-renderer-session startup splash and authoritative launcher bootstrap; `/main-menu`, `/arkpacks`, `/settings`, and `/about` are explicit launcher leaves. `/game/$packageId` is a non-visual resource boundary and `/game/$packageId/board` is the explicit gameplay page; every blocking leave/reset/exit operation is its own `action/*` leaf with a loader-owned lifecycle and standalone Hero pending page; recoverable bootstrap errors stay local while critical leave/reset/ownership failures replace the renderer through one root fatal boundary. Official Arkini and validated imported packages share one root-owned catalog backed by Electron storage. [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/installation) owns only the stable identity and lifetime of the renderer-wide singleton `GameEngineResource` under `["game-engine"]`; canonical gameplay state remains inside `GameSession`, UI reads the parent route loader through `useGameEngine()`, and no `useQuery()` gameplay mirror exists.

The selected game renders canonical Board, Inventory, and Toolbar slot and hit geometry through one Canvas-wide [Motion for React](https://motion.dev/docs/react) actor layer with one DOM actor per runtime item. The Inventory is one non-modal Canvas-local surface, the optional Toolbar is one passive row, and the same actor identity moves across all three surfaces without a clone. Each centered inner tile body rests at scale `0.8`; pointer targets drive the real actor through bounded Motion springs while exact engine preflight distinguishes authored merge, default-line input acceptance, compatible stack transfer, ordinary placement or swap, ignore, and rejection before the final command revalidates atomically. Runtime snapshots and their ordered semantic events reach tile presentation as one committed transition and each transient batch is claimed once per live `GameSession`. Exact committed facts drive spawn and delivery, stack absorption, full and partial input storage, job start and completion, expiry, and depletion signatures, while every visibly travelling actor drives the bounded local non-recursive crowd field from its actual rendered body. Future choreography belongs here only when the engine publishes a corresponding exact semantic fact.

The canonical runtime architecture is considered stable. Do not redesign it without a concrete requirement or reproduced defect.

## Read this first

The active documentation surface is deliberately small. Read it in this order:

1. [`README.md`](README.md) — repository orientation, commands, and ownership.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — canonical runtime, Tick, session, save, and UI boundaries.
3. [`CODE_GUIDE.md`](CODE_GUIDE.md) — mandatory code grammar and review rules.
4. [`CONFIG.md`](CONFIG.md) — game authoring, compiler, validation, schema, and packing.
5. [`GAME.MD`](GAME.MD) — implemented gameplay semantics.
6. [`ARKPACK_SIGNING.md`](ARKPACK_SIGNING.md) — package-authorship, key handling, and trust-state contract.
GitHub Issues are the only active backlog and continuation map. No repository Markdown file may act as a second current-status queue.

When documentation and implementation disagree, stop and resolve the contradiction. Do not quietly choose whichever version makes the current task easier.

## Path convention

The repository has explicit active [engine](src/engine), [bridge](src/bridge), [UI](src/ui), [page](src/page), and [route](src/@routes) boundaries:

```text
src/engine
→ standalone canonical engine, compiler, validation, CLI support, runtime, and public domain operations

src/bridge
→ the only legal live connection from UI to public engine contracts, grouped as bridge/<domain>/<operation>

src/ui
→ reusable React presentation, gesture, geometry, animation, and renderer components

src/page
→ route-level screen and layout composition over UI components

src/@routes
→ TanStack Router registration plus route-owned beforeLoad/loader/redirect/context orchestration through public bridge and UI contracts; generated hierarchy lives in src/_route.ts
```

Renderer dependencies form an explicit DAG: `@routes → {page, ui, bridge}`, `page → ui`, `ui → bridge`, and `bridge → engine`. [Route modules](src/@routes) may orchestrate public bridge lifecycle Effects but never import the engine directly; lower layers never import route registration. [`electron/`](electron) is a sibling platform boundary and may not import the renderer or engine roots. [`src/router.tsx`](src/router.tsx) creates the router from the [generated tree](src/_route.ts) and [`src/main.tsx`](src/main.tsx) is the sole renderer entrypoint.

Documentation may abbreviate engine-owned paths such as `runtime/`, `tick/`, and `placement/`; they mean the corresponding directory under [`src/engine`](src/engine). Presentation-owned paths are written explicitly.

## Architecture in one screen

```text
game source fragments + PNG resources
→ canonical compiler
→ schema + semantic + resource validation
→ compressed Arkini pack
→ bundled or validated local package catalog

selected exact package + separately namespaced optional persisted state
→ hydrated runtime
→ serialized interruptible mutation planning
→ candidate validation
→ one STM committed transition
     runtime snapshot + transient events
→ canonical reads, listener-specific subscriptions, autosave, UI
```

The central rules are:

- one canonical committed runtime;
- every production write enters through the serialized runtime mutation path;
- runtime and transient events commit together;
- failed or interrupted planning commits nothing;
- Tick uses a fixed 200 ms simulation step and stores job time as `remainingMs`;
- UI may lag behind the canonical runtime for animation, but never becomes gameplay truth;
- persistence observes runtime identity, not transient event traffic;
- all exact identifiers use the single shared `IdSchema`;
- domain operations follow the mandatory `*Fx` grammar from [`CODE_GUIDE.md`](CODE_GUIDE.md).

## Source ownership

The active [source tree](src) is domain-first. Important areas are:

```text
common/       Shared primitive schemas and external-callback isolation.
compiler/     Source-fragment assembly and completed-config compilation.
event/        Transient event contracts committed with runtime changes.
game/         Effect services and layers for one loaded game/session.
input/        Input resolution, buffering, consume and reserve plans.
item/         Canonical item schemas and item reads.
job/          Active jobs, FIFO requests, start and completion behavior.
line/         Product-line rules, reads, resolution and run plans.
merge/        Directional item interaction authoring, validation, and atomic execution.
output/       Output rules and result resolution.
pack/         Binary encode/decode and directory packing.
placement/    Stack, spawn, scope and drop placement planning.
query/        Runtime item queries.
runtime/      Canonical runtime, committed-transition store and write boundary.
session/      Engine-visible ephemeral root state and session commands.
schema/       Completed game configuration root and JSON Schema generation.
start/        Initial Board, Inventory, and Toolbar planning.
state/        Serializable state conversion.
tick/         Clock adapter and deterministic fixed-step advancement.
bridge/       Live arkpack/game/session/runtime/save/event projections and adapters; never a second gameplay store.
ui/           React presentation and transient interaction state only.
validation/   Schema-adjacent semantic and resource diagnostics.
when/         Runtime condition evaluation.
```

Do not introduce generic junk drawers such as `shared`, `utils`, `helpers`, or `services`. Ownership must remain visible from the path.

## Installation

The repository pins Node `22.16.0` and npm `10.9.2` through [`.nvmrc`](.nvmrc), [`package.json`](package.json) `engines` and `packageManager`, and [GitHub Actions](.github/workflows). Use the pinned toolchain rather than letting local and CI package resolution quietly diverge.
`npm-run-all2` is intentionally pinned to `8.0.4`: version 9 raises its Node floor above this shared local/CI/sandbox runtime, while version 8 keeps the same `run-p` / `run-s` script interface.

The repository uses npm without a committed lockfile.

```bash
npm install
```

Project tooling has one canonical [Effect](https://effect.website/) [CLI entrypoint](cli/arkini.ts):

```bash
npm run arkini -- --help
npm run arkini -- game --help
npm run arkini -- desktop --help
```

Game authoring and desktop build/package workflows live in that command tree. npm scripts are thin convenience aliases; `npm-run-all2` is reserved for mechanical check and shard composition rather than domain orchestration.

## Required checks

Run the full gate before committing non-trivial work:

```bash
npm run check
```

It runs:

```text
Biome format check
→ source, test, and Electron TypeScript checks
→ game configuration validation
→ production Electron build (signs official Arkini and packs the unsigned demo once)
→ Dependency Cruiser architecture rules against generated build inputs
→ all ten deterministic Vitest shards
```

Application commands:

```bash
npm run dev
npm run build
npm run preview
npm run preview:macos
```

Arkini is an [Electron](https://www.electronjs.org/docs/latest/)-only product. `npm run dev` starts Electron with a [Vite](https://vite.dev/guide/)-powered renderer and HMR. `npm run build` signs and verifies official Arkini, packs the deliberately unsigned demo, and then produces the production Electron build, so a production private key must be available through ignored `.arkini/arkpack-private.pem` or `ARKINI_ARKPACK_PRIVATE_KEY`. `npm run preview` starts an existing production build without repacking or rebuilding it. `npm run preview:macos` is the packaged local preview: it cleans old package output, performs the same one-time pack/build stages, creates `release/mac-arm64/Arkini.app` with `electron-builder --dir`, prints that exact path, and launches the resulting bundle. There is no standalone web target, web persistence fallback, or alternate renderer startup path.

Appearance is renderer-owned and exposed through semantic Tailwind color utilities backed by one CSS token palette. `/settings` is the only theme-control surface and offers `system`, `light`, and `dark`; `system` follows later operating-system appearance changes, while explicit light/dark selections override them. The complete standalone TanStack mutation applies the selected theme immediately, persists it through the authoritative Effect/desktop capability, rolls back on failure, and treats the active value as a no-op. The accent remains a separately persisted semantic palette used by the launcher and game. Missing or malformed preferences resolve to dark and rose. Electron persists both values atomically under `userData/arkini/preferences`, applies the theme through `nativeTheme`, and exposes no browser-storage settings path.

`npm install` runs Electron's official `install-electron` binary through the project `postinstall`, so the matching native executable is prepared during dependency installation rather than during application startup. Closing the last Electron window quits the application and also terminates the owning `electron-vite` command and renderer development server.

The main window opens centered at 75% of the active monitor work area. `F11` and `Alt+Enter` toggle native fullscreen. One [root renderer canvas](src/ui/canvas/Canvas.tsx) owns the exact viewport, hides document scrollbars, and requires game/UI content to fit the available window rather than expanding it; the board continuously uses the largest rectangle that preserves its authored aspect ratio.

The router uses standard history routing. `/` starts with an approximately 500 ms pure-black hold while one authoritative bootstrap immediately prepares trusted desktop readiness, persisted theme/accent, shared Arkpack catalog metadata, the canonical built-in package, and Hero readiness. The complete Hero scene then fades in and remains until bootstrap succeeds and the five-second minimum has elapsed. Escape and its prompt share one truthful `canContinue` condition: hard bootstrap must be ready, the splash must be in its interactive enter/open lifecycle, and the five-second minimum must still be skippable; black hold, loading, automatic continuation, and exit ignore the key and never advertise it. Failures stay retryable on the splash, and later renderer-session visits to `/` redirect to `/main-menu`. `/main-menu` provides Play, Arkpacks, Settings, About, and trusted native Exit; `/arkpacks` contains the moved package selector, `/settings` contains the sole System/Light/Dark control, `/about` contains credits, and a selected package runs at `/game/<packageId>`. During development Electron loads the renderer from the Vite HTTP origin for HMR. Packaged Electron serves the same renderer and route tree from `arkini://app/`, including all launcher, game, and development routes. Hash routing and `file://` are not supported route modes.

Electron treats the renderer as one explicit trusted [security boundary](electron/main/security). Development accepts only the configured loopback Vite origin; packaged builds ignore development renderer environment overrides and accept only `arkini://app/*`. External navigation, redirects, subframes, webviews, popups, and Chromium permission requests are denied. Every Arkpack, save, appearance, and lifecycle IPC request must come from the registered Arkini `BrowserWindow`, its exact `webContents`, and its trusted main frame. Packaged protocol responses carry a restrictive CSP. Development derives the exact HTTP and HMR WebSocket endpoints from one validated loopback URL and gives Vite one per-server CSP nonce for its React Refresh preamble; production receives neither the nonce nor any development transport allowance.

Arkpack and game-save persistence are Effect-native inside the renderer bridge and Electron main. Promise is used only by the typed preload/IPC transport. Main filesystem behavior is composed from narrow object factories over `@effect/platform`; there are no project-owned repository/storage classes or no-op close contracts.

Packaged renderer assets are rooted through `<base href="/">`; `npm run build` verifies the generated asset graph from `/`, `/game/$packageId`, and nested `/dev/**` routes before succeeding.

## macOS packaging and prereleases

For a packaged local smoke test without release archives, run:

```bash
npm run preview:macos
```

This canonical [Effect CLI command](cli/desktop/DesktopPreviewMacosCommand.ts) generates the official Arkpack once, builds Electron once, stages the production app, creates only the unpacked arm64 `release/mac-arm64/Arkini.app`, prints its path, and launches that exact bundle with macOS `open`. It does not create DMG, ZIP, checksums, signing, notarization, or release assets.

The production distribution target is unsigned macOS Apple Silicon only. Build both local artifacts through the one canonical path:

```bash
npm run package:mac
```

The [desktop package command](cli/desktop/DesktopPackageCommand.ts) cleans old package output, packs the official Arkini game once, builds Electron main/preload/renderer once, stages only `out/**` with a dependency-free production manifest, and runs one concrete [`electron-builder`](https://www.electron.build/docs/) arm64 DMG/ZIP operation. SHA-256 values are streamed from the large artifacts once while `SHA256SUMS` is written; the combined package flow then verifies artifact presence and the unpacked `Arkini.app` seam without hashing the same files again. `npm run package:verify` remains the standalone full checksum verification path for downloaded or later-modified artifacts. Output lives under `release/`:

```text
Arkini-<version>-mac-arm64.dmg
Arkini-<version>-mac-arm64.zip
SHA256SUMS
mac-arm64/Arkini.app
```

Verify downloads with `shasum -a 256 -c SHA256SUMS`. These development artifacts are intentionally unsigned and unnotarized. macOS may require opening the application through Finder's **Open** action or allowing it from **System Settings → Privacy & Security**. Do not add ad-hoc signing, fake certificates, or notarization placeholders to this milestone.

The [macOS prerelease workflow](.github/workflows/macos-prerelease.yml) uses the same `npm run package:mac` command on the GitHub-hosted `macos-15` Apple Silicon runner. CI runs formatting, type, and source-validation gates first, packages exactly once, then runs Dependency Cruiser and permanent tests against those exact generated package inputs instead of relying on stale ignored output or running a second production build through `npm run check`. Manual dispatch uploads a normal workflow artifact only. Tags matching `v*-dev.*`, such as `v0.1.0-dev.1`, also create an immutable GitHub prerelease containing the DMG, ZIP, and `SHA256SUMS`. Normal source pushes do not spend macOS runner time.

Useful focused commands:

```bash
npm run format
npm run format:check
npm run dc
npm run typecheck
npm run test
npm run test:shards
npm run test:shard:1
```

`npm run test` remains the canonical one-process full-suite command. Use
`npm run test:shards` or the ten individual `test:shard:N` commands when the
execution environment has a short process timeout. Each shard contains a smaller
deterministic file partition and still runs with one worker from [`vitest.config.ts`](vitest.config.ts).
When a chained runner fails to exit cleanly, run the affected shard independently.


## Local packages and saves

The launcher treats `.arkpack` as the playable package boundary:

- official Arkini is listed from generated metadata without reading payload bytes; exact startup reads its binary and detached signature, verifies Ed25519 against the committed public registry before decode, and fails closed unless the expected official key is established;
- the bundled [`game/demo`](game/demo) package is deliberately unsigned and labeled external, proving that bundled delivery does not imply official authorship;
- imported binaries are addressed by their exact SHA-256 identity and persist under `<userData>/arkini/arkpacks/<packageId>/package.arkpack`; derived `descriptor.json` metadata is rebuildable and catalog listing never reads payload bytes;
- exact package load verifies trust over raw bytes before decode, then revalidates hash, config, resources, and identity before a game starts;
- renderer import rejects files above the compressed package limit before `File.arrayBuffer()` allocates them, while the binary reader keeps the same guard for non-File callers;
- gameplay saves use the minimal MessagePack envelope `{ namespace: "arkini", format: 1, state }` and persist atomically under `<userData>/arkini/saves/<packageId>/<contentHash>/current.arksave`;
- `pending.arksave` is temporary write state. A failed replacement leaves the previous successful `current.arksave` intact;
- package binaries and gameplay saves are separate storage boundaries. Removing an imported package does not delete its save, and reinstalling the exact bytes may resume it;
- one canonical TanStack Query slot `["game-engine"]` owns the renderer's sole live `Game`; `/action/load-game/$packageId` registers and creates it through `ensureQueryData`, while `/game/$packageId` exposes the same instance through inherited router context and loader data. Controlled close and HMR join pending creation, lifecycle actions serialize through the resource semaphore, and successful cleanup removes the query only when it still contains that exact resource. Failed ordinary leave/reset lifecycle work retains the exact cached game only as an unusable diagnostic/final-save obligation, marks the resource fail-stop, and renders one root fatal close screen; Board can never be republished over it. Native force close terminates the process only after an explicit user decision and does not pretend renderer cleanup or final save succeeded;
- package validation failures never expose save deletion because no save identity is trusted. When a verified package fails specifically during durable save decode or runtime hydration, the failed exact Game query retains `GameSaveBootstrapError`; the error page only links to `/action/recover-game-save`, whose loader resolves that verified error, clears only its exact save, removes the failed query, and returns through the normal bootstrap;
- product runtime always uses the mandatory Electron preload capabilities. In-memory package/save adapters exist only under [`test/support`](test/support) and are injected explicitly by tests;
- Arkpacks remain data-only. The current format accepts completed config plus PNG resources, never JavaScript or HTML.

## Game authoring commands

The default game source directory is [`game/arkini`](game/arkini).

```bash
npm run game:schema
npm run game:validate
npm run game:pack
npm run game:pack:demo
npm run game:pack:official
```

- `game:schema` writes the authoring JSON Schema to [`game/schema.json`](game/schema.json).
- `game:validate` runs the canonical compiler and all diagnostics.
- `game:pack`, implemented by the [pack command](src/engine/pack/cli/PackCommand.ts), remains an explicit unsigned authoring operation: it validates the completed config, reads PNG resources, encodes MessagePack, compresses it with gzip, and writes the binary plus tracked metadata.
- `game:pack:demo` packs the merge-only demo without a signature.
- `game:pack:official` packs final Arkini bytes, signs them with Ed25519, writes the detached `.sig`, and verifies the result against the committed public registry.
- The canonical desktop build owns signed official packing, unsigned demo packing, then [`buildDesktopOutputFx`](cli/desktop/buildDesktopOutputFx.ts). `build`, `preview:macos`, and `package:mac` generate both ignored binaries exactly once before the renderer imports them. The local `check` order builds before Dependency Cruiser, and the macOS delivery workflow packages before Dependency Cruiser, so fresh checkouts never depend on stale generated output.

[`ARKPACK_SIGNING.md`](ARKPACK_SIGNING.md) is the complete threat model, CLI, private-key, CI-secret, trust-state, and rotation contract.

The compiler, validator, tests, and packer must never assemble different versions of the game configuration.

## Working agreement

- Preserve `.git` in every shared repository snapshot.
- Never include `node_modules` in delivered ZIP files.
- Commit coherent slices instead of one giant cleanup blob.
- Keep active documentation current; track work in GitHub Issues and use Git history for completed plans and superseded decisions.
- Do not cite archived documents as current contracts.
- Avoid architecture work without a concrete problem. Refactoring for the emotional satisfaction of moving boxes is still moving boxes.
