# Arkini

<p align="center">
  <img src="game/arkini/resources/hero.png" alt="Arkini logo with winged unicorns and magical machinery" width="100%" />
</p>

Arkini is a client-only, offline merge and production game built around a deterministic, data-driven engine. The current runtime slice backs production lines, jobs, queueing, output rolls, placement, directional merge, finite lifetime and charges, utility controls, state, save, and session boundaries. [`CONFIG.md`](CONFIG.md) and [`GAME.MD`](GAME.MD) define the exact authoring and gameplay contracts. The repository is intentionally maintained with an LLM as the primary implementer, so documentation is part of the correctness boundary rather than decorative prose that slowly becomes compost.

**Product direction:** Marek

**Architecture, implementation, and documentation:** GPT-5.6 Thinking, professionally harassed into precision by Marek

## Current status

The engine, compiler, validator, binary packer, deterministic Tick model, persisted Instant gameplay control, jobs, queueing, reservations, placement, persistence boundary, and live React bridge are implemented and covered by the repository check gate.

The client uses [TanStack Router](https://tanstack.com/router/latest/docs/overview) file-based routing. `/` owns a one-renderer-session startup splash and authoritative launcher bootstrap; `/main-menu`, `/arkpacks`, `/settings`, and `/about` are explicit launcher leaves. `/game/$packageId` is a non-visual installed-package resource boundary and `/game/$packageId/board` is the explicit gameplay page; every blocking leave/reset/exit operation is its own `action/*` leaf with a loader-owned lifecycle and standalone Hero pending page; recoverable bootstrap errors stay local while critical leave/reset/ownership failures replace the renderer through one root fatal boundary. Official Arkini and validated imported packages share one root-owned catalog backed by Electron storage. One scoped Effect service owns the installed `GameEngineResource`, while a separate scoped service owns the Editor's revision-pinned, discard-only game. Canonical gameplay state remains inside `GameSession`; a non-owning `GameEngineProvider` lets both surfaces reuse the exact Board UI without a React-owned gameplay mirror.

The selected game renders Board and Toolbar through one retained [PixiJS](https://pixijs.com/) scene covering the complete game viewport. React still owns route, menu, item-detail, and modal composition; Inventory is a routed React-framed leaf with its own isolated Pixi scene. Board and Toolbar share retained actor identity, while Inventory release carries only a short-lived origin geometry keyed by its source actor; the engine remains free to preserve, normalize, stack, or replace runtime identity. Pixi owns scene geometry, hit testing, z-order, display-object lifetime, and demand rendering. [Motion](https://motion.dev/) owns interruptible travel, pickup correction, and magnetic springs; none of those presentation channels can become gameplay truth. Exact engine preflight distinguishes authored merge, default-line input acceptance, compatible stack transfer, Inventory storage, ordinary placement or swap, ignore, and rejection before the final command revalidates atomically. Runtime snapshots and ordered semantic events remain the standalone fact stream consumed by presentation, audio, and telemetry.

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

Renderer dependencies form an explicit DAG: `@routes → {page, ui, bridge}`, `page → ui`, `ui → bridge`, and `bridge → engine`. [Route modules](src/@routes) may orchestrate public bridge lifecycle Effects but never import the engine directly; lower layers never import route registration. [`electron/main`](electron/main) owns the backend process and composes feature-owned persistence, MCP, IPC, protocol, and public editor/engine capabilities; it never imports renderer modules or engine internals. Renderer bridge domains consume only the pure [`electron/contract`](electron/contract) transport seam, while editor and engine domains never import Electron. [`src/createArkiniRouterFx.tsx`](src/createArkiniRouterFx.tsx) creates the router from the [generated tree](src/_route.ts) and [`src/main.tsx`](src/main.tsx) is the sole renderer entrypoint.

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
→ concurrent command admission
→ narrowly serialized interruptible mutation planning
→ candidate validation
→ one SubscriptionRef committed transition
     runtime snapshot + transient events
→ canonical reads, listener-specific subscriptions, autosave, UI
```

The central rules are:

- one canonical committed runtime;
- independent commands run concurrently until each production write enters the short serialized
  runtime mutation path;
- runtime and transient events commit together;
- failed or interrupted planning commits nothing;
- Tick uses a fixed 100 ms simulation step and stores job time as `remainingMs`;
- job commands admit work only; Tick owns progress and completion, including Instant gameplay;
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

The repository uses [`mise`](https://mise.jdx.dev/) as its only toolchain manager. [`mise.toml`](mise.toml) pins Node, npm, and [`argc`](https://github.com/sigoden/argc), while [`Argcfile.sh`](Argcfile.sh) is the single repository command surface. After installing mise, prepare a checkout with:

```bash
mise install
./Argcfile.sh install
```

The install recipe runs `npm ci` against the committed [`package-lock.json`](package-lock.json). JavaScript dependencies remain package-local and `mise.toml` adds `node_modules/.bin` to `PATH`, so recipes call project binaries directly. `package.json` contains package metadata, dependency declarations, and only the required Electron `postinstall` lifecycle script; it is not a second task runner.

The application ships one canonical [Effect](https://effect.website/) product CLI. A packaged
app can install or remove the `arkini-cli` launcher from Settings:

```bash
arkini-cli --help
arkini-cli game --help
arkini-cli arkpack --help
```

Game authoring and Arkpack operations live only in that production command tree. Repository automation is plain Bash in `Argcfile.sh`; product work always goes through the freshly built product CLI.

## Required checks

Run the full gate before committing non-trivial work:

```bash
./Argcfile.sh check
```

It runs:

```text
Biome format check
→ source, test, and Electron TypeScript checks
→ production Electron build and built-CLI official Arkpack signing
→ Dependency Cruiser architecture rules against generated build inputs
→ copy/paste detection
→ the isolated parallel Vitest suite
```

Application commands:

```bash
./Argcfile.sh dev
./Argcfile.sh dev-control
./Argcfile.sh mcp-inspect
./Argcfile.sh build
./Argcfile.sh preview-macos
./Argcfile.sh package-macos
```

Arkini is an [Electron](https://www.electronjs.org/docs/latest/)-only product. `dev` starts Electron with a [Vite](https://vite.dev/guide/)-powered renderer. The editor's MCP workspace explicitly starts either the open loopback endpoint at `http://127.0.0.1:32310/editor/mcp` or an OAuth-protected Remote MCP endpoint over ngrok; both modes share one lazy local listener and remain off until requested. `mcp-inspect` starts the pinned Inspector independently for the loopback endpoint. MCP tools are dynamically scoped to the single project currently mounted in the editor and fail without touching persistence when no project is open. Port, ngrok configuration, generated password, OAuth clients, codes, and tokens persist in `<userData>/arkini/editor/mcp.json`; only the ngrok `authtoken` value is encrypted with Electron `safeStorage`. Explicit Reset auth replaces the password and OAuth state while preserving transport configuration. Vite may replace modules during development, but Arkini treats application state as disposable and implements no HMR preservation, shutdown, or ownership handoff. `build` compiles the production Electron application, then uses that exact built CLI to pack, sign, and verify official Arkini, so a private key must be available through ignored `.arkini/arkpack-private.pem` or `ARKINI_ARKPACK_PRIVATE_KEY`. `preview-macos` rebuilds the same inputs, creates an unpacked arm64 application, and launches it. There is no standalone web target, web persistence fallback, or alternate renderer startup path.

All disposable repository-local generated output lives below `.out/`: Electron build files under `.out/desktop/build`, distributable artifacts under `.out/desktop/release`, and tool caches under `.out/cache`. Electron Builder maps the build directory directly into the packaged ASAR through configuration; there is no repository staging pipeline. The `game/` tree is the deliberate generated-output exception because authored games and their generated Arkpack/schema companions share one domain-owned location. Local build inputs such as signing keys remain config under `.arkini/` and must survive deleting `.out/`.

`dev-control` starts the same application with Chromium DevTools Protocol exposed at `http://127.0.0.1:9222` for local UI automation and profiling. The endpoint is fixed to loopback and is never enabled by packaged builds.

Appearance is renderer-owned and exposed through semantic Tailwind color utilities backed by one CSS token palette. `/settings` is the only theme-control surface and offers `system`, `light`, and `dark`; `system` follows later operating-system appearance changes, while explicit light/dark selections override them. One `Atom.fn` command applies the selected theme immediately, serializes persistence through the authoritative Effect/Electron capability, rolls back only its own still-current optimistic value on failure, and treats the active value as a no-op. The accent remains a separately persisted semantic palette used by the launcher and game. Missing or malformed preferences resolve to dark and rose. Electron serializes and atomically persists both values under `<userData>/arkini/game/preferences`, applies the theme through `nativeTheme`, and exposes no browser-storage settings path.

`./Argcfile.sh install` runs Electron's official `install-electron` binary through the project `postinstall`, so the matching native executable is prepared during dependency installation rather than during application startup. Closing the last Electron window quits the application and also terminates the owning `electron-vite` command and renderer development server.

The first global Settings control chooses `Default`, `Bordered`, or `Fullscreen` through the same segmented presentation as Theme. Default applies the canonical centered 75% bounds on the active display, Bordered maximizes the title-bar window into the display work area, and Fullscreen uses the explicitly enabled native fullscreen space. One main-process controller owns each BrowserWindow transition; the renderer remains pending until Electron confirms its asynchronous fullscreen event and therefore never presents a requested mode as physical truth. Electron atomically persists the last confirmed mode under `<userData>/arkini/game/preferences`; startup restores it, and `F11`, `Alt+Enter`, native fullscreen, maximize, and unmaximize changes update the same preference and live Settings state. Leaving fullscreen returns to the windowed mode that preceded it. One [root renderer canvas](src/ui/canvas/Canvas.tsx) owns the exact viewport, hides document scrollbars, and requires game/UI content to fit the available window rather than expanding it; the board continuously uses the largest rectangle that preserves its authored aspect ratio.

The router uses standard history routing. `/` starts with an approximately 500 ms pure-black hold while one authoritative bootstrap immediately prepares trusted Electron readiness, persisted theme/accent/window mode, the effective Arkpack catalog, the default package, and Hero readiness. The complete Hero scene then fades in and remains until bootstrap succeeds and the five-second minimum has elapsed. Escape and its prompt share one truthful `canContinue` condition: hard bootstrap must be ready, the splash must be in its interactive enter/open lifecycle, and the five-second minimum must still be skippable; black hold, loading, automatic continuation, and exit ignore the key and never advertise it. Failures stay retryable on the splash, and later renderer-session visits to `/` redirect to `/main-menu`. `/main-menu` provides Play, Editor, Arkpacks, Settings, About, and trusted native Exit; `/editor/welcome` creates a managed Editor project from a validated Arkpack or opens a valid Editor project folder directly in place, `/arkpacks` contains the moved package selector, `/settings` contains the global appearance, window-mode, diagnostics, and developer controls, `/about` contains credits, and a selected package runs at `/game/<packageId>`. During development Electron loads the renderer from the Vite HTTP origin. Packaged Electron serves the same renderer and route tree from `arkini://app/`, including all launcher, game, and development routes. Hash routing and `file://` are not supported route modes.

Electron treats the renderer as one explicit trusted [security boundary](electron/main/security). Development accepts only the configured loopback Vite origin; packaged builds ignore development renderer environment overrides and accept only `arkini://app/*`. External navigation, redirects, subframes, webviews, popups, and Chromium permission requests are denied. Every Arkpack, editor, save, appearance, and lifecycle IPC request must come from the registered Arkini `BrowserWindow`, its exact `webContents`, and its trusted main frame. Packaged protocol responses carry a restrictive CSP. Development derives the exact HTTP and HMR WebSocket endpoints from one validated loopback URL and gives Vite one per-server CSP nonce for its React Refresh preamble; production receives neither the nonce nor any development transport allowance.

`/editor/$projectId/chatgpt` is the one deliberate foreign-web surface. Electron places a sandboxed, Node-free `WebContentsView` for `https://chatgpt.com` inside the measured editor content rectangle while Arkini keeps ownership of its navbar and route. The view uses its own persistent `persist:arkini-chatgpt` session and may follow credential-free HTTPS navigation needed by federated login. Popup targets are funneled into that same isolated view while unmanaged second windows, non-HTTPS navigation, permissions, preload, and every Arkini IPC trust path remain denied. Arkini detaches the native surface and shows its own loading state during each page navigation, then reattaches only the completed page. Leaving the section preserves the live view; returning from an external or still-pending navigation resets it to ChatGPT. Only a visible view may stage one bounded PNG download. Arkini validates the bytes canonically and requires an explicit revision-pinned insert or second-step replacement confirmation before the filesystem repository writes it; discard and rejected downloads never write project state.

Arkpack and game-save persistence are Effect-native inside the renderer bridge and Electron main. Promise is used only by the typed preload/IPC transport. Main filesystem behavior is composed from narrow object factories over the `FileSystem` and `Path` capabilities exported by `effect`; `@effect/platform-node` supplies their one Electron/CLI implementation. There are no project-owned repository/storage classes or no-op close contracts.

Packaged renderer assets are rooted through `<base href="/">` and served from the trusted `arkini://app` protocol on every route.

## macOS packaging and prereleases

For a packaged local smoke test without release archives, run:

```bash
./Argcfile.sh preview-macos
```

This recipe cleans desktop output, builds Electron and the official Arkpack once, asks Electron Builder for the unpacked arm64 `.out/desktop/release/mac-arm64/Arkini.app`, and launches that exact bundle with macOS `open`. It does not create DMG, ZIP, checksums, macOS code signing, notarization, or release assets.

The production distribution target is unsigned macOS Apple Silicon only. Build both local artifacts through the one canonical path:

```bash
./Argcfile.sh package-macos
```

The recipe cleans `.out/desktop`, builds Electron main/preload/renderer once, packs the official Arkini game through the built product CLI, and runs one concrete [`electron-builder`](https://www.electron.build/docs/) arm64 DMG/ZIP operation. The Electron Builder config maps `.out/desktop/build/**` directly below `app/**` in ASAR, overrides the packaged entrypoint, and excludes repository `node_modules` because all runtime dependencies are already bundled. The recipe writes `SHA256SUMS` with macOS `shasum` and smoke-tests the packaged `arkini-cli --version`. Output lives under `.out/desktop/release/`:

```text
Arkini-<version>-mac-arm64.dmg
Arkini-<version>-mac-arm64.zip
SHA256SUMS
mac-arm64/Arkini.app
```

Verify downloads with `shasum -a 256 -c SHA256SUMS`. These development artifacts are intentionally unsigned and unnotarized. macOS may require opening the application through Finder's **Open** action or allowing it from **System Settings → Privacy & Security**. Do not add ad-hoc signing, fake certificates, or notarization placeholders to this milestone.

The [macOS prerelease workflow](.github/workflows/macos-prerelease.yml) installs the repository tools through `mise-action` and invokes the same `./Argcfile.sh ci-macos` entrypoint on the GitHub-hosted `macos-15` Apple Silicon runner. That recipe runs formatting and type gates, packages exactly once, then runs Dependency Cruiser, copy/paste detection, and the isolated parallel test suite. Manual dispatch uploads a normal workflow artifact only. Tags matching `v*-dev.*`, such as `v0.1.0-dev.1`, also create an immutable GitHub prerelease containing the DMG, ZIP, and `SHA256SUMS`. Normal source pushes do not spend macOS runner time.

Useful focused commands:

```bash
./Argcfile.sh format
./Argcfile.sh typecheck
argc test
argc test test/job
./Argcfile.sh llm:cache
```

`argc test` is the canonical full-suite command and uses isolated worker threads capped at half of the available CPUs. Additional arguments filter Vitest by file or directory for fast local feedback. `llm:cache` builds and verifies a network-free Linux x64 npm cache, then archives it as `arkini-npm-cache-linux-x64-<lock-hash>.tgz`.


## Local packages and saves

The launcher treats `.arkpack` as the playable package boundary:

- Electron scans two flat roots for `<encoded-packageId>.game.arkpack` and optional `.sig` siblings: repository `game/` in development or packaged `Resources/game`, plus writable `<userData>/arkini/game/arkpacks`;
- format v2 embeds a stable `packageId` in the signed package bytes independently from the authored `gameId`. The renderer derives `contentHash`, trust, title, and game metadata from the exact bytes instead of trusting generated catalog metadata;
- a structurally valid user package legally overrides a bundled package with the same ID. The renderer selects from both raw candidates, so an unreadable user file falls back consistently while an invalidly signed package stays visible but unavailable. The catalog labels the effective user row `User override`; removing it touches only user data and reveals the bundled fallback;
- the Arkpack screen can open only the user package folder and explicitly refresh after manual copies. The bundled root is never exposed through UI;
- trust is derived only from the optional detached signature. Bundled location and package name confer no trust; official Arkini carries a verifiable Ed25519 signature;
- exact package load verifies trust over raw bytes before decode, then revalidates filename identity, embedded package identity, config, resources, and SHA-256 content hash before a game starts;
- renderer import rejects files above the compressed package limit before `File.arrayBuffer()` allocates them, while the binary reader keeps the same guard for non-File callers;
- gameplay saves use the strict MessagePack envelope `{ namespace: "arkini", version, game, state }` and persist atomically under `<userData>/arkini/game/saves/<packageId>/current.arksave`;
- `pending.arksave` is temporary write state. A failed replacement leaves the previous successful `current.arksave` intact;
- package binaries and gameplay saves are separate storage boundaries. Removing an imported package does not delete its save; a compatible package with the same ID may resume it, while a different major version clears it and starts fresh;
- one scoped Effect service in `RendererRuntime` owns the renderer's sole live installed `Game`; `/action/load-game/$packageId` acquires a scoped provisional lease and adopts that exact resource only after its action hold completes, while `/game/$packageId` exposes the same instance only through inherited router context. Controlled close atomically claims pending creation, and one service-owned state machine serializes acquisition, replacement, release, reset, failed-save recovery, and runtime shutdown. Gameplay observers mount only around playable Board/Cheats pages, never around leave/reset/exit action routes. Active-game controlled close replace-navigates to `/game/$packageId/action/exit`, whose loader owns one best-effort final save/disposal while the shared Hero action page moves from synthetic pending progress to a completed frame before Electron closes; no-game close remains direct. Arkini deliberately does not preserve or hand off application/Game state across HMR. Failed ordinary leave/reset lifecycle work retains the exact game only as an unusable diagnostic/final-save obligation, marks the resource fail-stop, and renders one root fatal close screen; Board can never be republished over it. Native force close terminates the process only after an explicit user decision and does not pretend renderer cleanup or final save succeeded;
- package validation failures never expose save deletion because no save identity is trusted. When a verified package fails specifically during durable save decode or runtime hydration, the Game resource authority retains the exact `GameSaveBootstrapError`; the error page only links to `/action/recover-game-save`, whose loader resolves that verified error, clears only its exact save, discards that exact failed service state, and returns through the normal bootstrap;
- product runtime always uses the mandatory Electron preload capabilities. In-memory package/save adapters exist only under [`test/support`](test/support) and are injected explicitly by tests;
- Arkpacks remain data-only. The current format accepts completed config plus PNG resources, never JavaScript or HTML.
- the engine owns the portable game-project filesystem format: generated root `schema.json`, `project.json`, `game.json`, `items/<type>/<uid>.json`, `assets/`, `resources/`, `notes/`, `scenarios/`, `versions/`, and `objects/`. The Editor and `arkini-cli game pack` consume the same format. `project.json` contains only the Arkini version that last saved the project and `updatedAtMs`; `game.json` contains the authoritative package ID in `meta.id`, the authored `arkpack` version, and a `./schema.json` reference, while item fragments reference `../../schema.json`. The marker, schema, and references must match the exact current contract. Electron main owns only the `<userData>/arkini/editor/projects.json` root catalog and the narrow validated IPC repository; project identity is always read from the validated root's `game.json` `meta.id`, never copied into the catalog. New projects and validated Arkpack imports create managed directories below user data, while project-folder import requires the root marker and opens an external directory directly in place. Project SQLite, IndexedDB, `editor.json`, and other historical formats are outside the runtime contract. Project writes use a short-lived `editor.lock`; each changed file uses a fixed sibling `.tmp`, sync, and rename, while additions and replacements precede deletions and `project.json` publishes last. Multi-file saves deliberately have no journal, rollback, or startup recovery. External changes are ignored until explicit Refresh from disk, which hard-resets drafts and the Editor Board. JSON export copies the portable folder. Version manifests reference full content-addressed objects and become visible only through publish-last `versions/head.json`. Installation-wide MCP configuration and OAuth state share `editor/mcp.json`.
- the Editor Board runs the same canonical session commands and routed Board, Toolbar, Inventory, Item Detail, audio, cheat spotlight, and Pixi UI as installed gameplay. Its process-owned lifecycle has no autosave and serially discards the old session before publishing a changed project revision, restoring a scenario, or refreshing from disk. `Cmd+P` is always admitted there through canonical Cheat mode. The live Board is excluded from portable project state. Named scenarios are portable, versioned JSON envelopes around `StateSchema` bytes: strict same-major restore deletes only a proven-invalid scenario, while every major project save removes all scenarios before publishing the new project marker and minor saves preserve them.

## Game authoring commands

The default game source directory is [`game/arkini`](game/arkini).

```bash
arkini-cli game schema
arkini-cli game validate
arkini-cli game pack
arkini-cli arkpack pack-official
```

- `game schema` writes the authoring JSON Schema to [`game/schema.json`](game/schema.json).
- `game validate` runs the canonical compiler and all diagnostics.
- `game pack`, implemented by the [pack command](src/engine/pack/cli/PackCommand.ts), is an explicit unsigned authoring operation: it validates the completed config, reads PNG resources, embeds the package ID in MessagePack, compresses it with gzip, and writes the ignored binary.
- `arkpack pack-official` packs final Arkini bytes, signs them with Ed25519, writes the detached `.sig`, and verifies the result against the committed public registry.
- The canonical desktop build first compiles Electron/Vite with no generated game imports, then invokes its built `arkini-cli` to produce the signed official game exactly once. `electron-builder` delivers only `.arkpack` and `.sig` files into packaged `Resources/game`.

[`ARKPACK_SIGNING.md`](ARKPACK_SIGNING.md) is the complete threat model, CLI, private-key, CI-secret, trust-state, and rotation contract.

The compiler, validator, tests, and packer must never assemble different versions of the game configuration.

## Working agreement

- Preserve `.git` in every shared repository snapshot.
- Never include `node_modules` in delivered ZIP files.
- Commit coherent slices instead of one giant cleanup blob.
- Keep active documentation current; track work in GitHub Issues and use Git history for completed plans and superseded decisions.
- Do not cite archived documents as current contracts.
- Avoid architecture work without a concrete problem. Refactoring for the emotional satisfaction of moving boxes is still moving boxes.
