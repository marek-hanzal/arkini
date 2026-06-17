# JSON game definition package plan - 2026-06-17

Status: TODO

## Product goal

Move Arkini static game content/rules toward an external JSON-authored game package. There is one canonical final shape in memory, but the authoring source may be one JSON file or many JSON fragments. This is a structural/content authoring change, not a TileEngine or UI rewrite.

The intended end state is a compiled `ArkiniGamePackage` that contains all static gameplay truth, including asset definitions/references, so the engine can consume the package and render/play that definition. The default Arkini package should ship with the app and be loaded by the game. Runtime save state remains separate.

JSON loading is explicitly TBD for the first pass. Do not start by wiring runtime loading into the app. First settle the canonical shape, source-fragment merge semantics, validation, then the loading/normalization path.

## Why this exists

Current v0 is already mostly data-driven, but the data still lives in TypeScript modules. That preserves TS types, but it makes broad game-design/content work expensive because the model has to keep navigating code-shaped config files. The new direction deliberately trades compile-time config typing for JSON source files plus a CLI validator/compiler that gives fast feedback during development. Yes, we are replacing TypeScript confidence with tooling discipline; civilization continues its proud tradition of moving problems sideways.

The authoring split is intentional: resources/assets can live in a separate JSON file from economy/gameplay rules, so content work can keep `resources.json` out of context while editing `game.json`. Later, item groups, upgrades, loot tables, balance patches or experiment overrides can live in their own fragments too.

## Core architecture direction

Use top-level collections keyed by stable IDs. Avoid nested domain objects that make reuse and validation harder.

There is one canonical final shape, but no requirement that authoring uses one physical file. The compiler/loader API should be conceptually boring:

```ts
load([json1, json2, json3]) -> ArkiniGamePackage
```

Each JSON source file may contain any subset of the canonical shape. A tiny one-file package is valid. A split package like `game.json` + `resources.json` is valid. A more granular package like `items.wood.json` + `lootTables.early.json` + `resources.icons.json` is valid. A small patch file that modifies one loot table can also be valid once patch semantics are explicitly defined.

Expected package sections, names still negotiable:

- `meta`: package id, name, version, schema version, build notes.
- `assets`: image/resource definitions keyed by asset id, initially likely inline base64 `{ mimeType, base64, width?, height?, hash? }`, but the source split must allow assets to live outside gameplay fragments.
- `items`: every item definition keyed by item id.
- `producers`: producer behavior definitions keyed by producer id.
- `stashes`: stash/container behavior definitions keyed by stash id.
- `lootTables`: reusable weighted output tables keyed by loot table id.
- `products`: reusable producer/product definitions keyed by product id. Producer outputs should reference product ids, not inline output objects.
- `mergeRules`: merge relationships keyed or listed with input/result ids.
- `upgrades`: upgrade/building/blueprint relationships keyed by upgrade id.
- `recipes`: craft/build recipes if/when separated from upgrades.
- `board`, `inventory`, `economy`, `timing`, `uiHints`: only if the current TS manifest actually needs these concepts represented outside code.

Everything cross-links by ID. Example: an item references `assetId`, a producer references `productIds` or a loot table id, a loot table references item ids or product ids, upgrade rules reference item/building ids. Avoid embedding full item/product/loot objects inside each other.

### Source fragments and merge semantics

The manifest file is optional convenience only, not the foundation. The validator/compiler must accept explicit files directly:

```bash
npm run game:validate game.json resources.json
npm run game:validate game.json resources.json loot-overrides.json
```

Possible manifest support can come later as a shortcut for default app loading or authored packages, but the core API should not require it. Browser/manual import can expose multiple file inputs or one multi-file upload and pass parsed JSON objects to the same compiler.

Initial merge semantics should be conservative and easy to explain:

- top-level object collections merge by key.
- duplicate IDs are errors by default, because silent overwrite is how config systems become crime scenes.
- patch/override files must opt in explicitly, e.g. via a top-level `patches` section or source metadata, before replacing existing keys.
- arrays should be avoided for ID-addressable definitions; use keyed objects so merge paths are stable.
- validation runs after compilation against the final canonical package, but errors should report the original source file and JSON path where practical.

## Critical boundaries to preserve

- The JSON package describes game content and rules. It must not contain mutable save state.
- TileEngine stays generic and must not know this schema directly.
- Runtime domain code may normalize validated JSON into whatever internal read model is convenient, but the package file itself should stay authoring-friendly and ID-linked.
- No server dependency. Arkini remains a client-only/offline SPA.
- Default package loading can be static/import-based initially. User-supplied package loading is a later concern unless explicitly requested.
- Engine/runtime code consumes only the compiled canonical package. It must not care whether the source came from one JSON file, several uploaded files, a manifest, OPFS, or some other future packaging nonsense.
- Preserve current game behavior unless the schema work exposes an intentional product decision.

## Implementation phases

### Phase 1 - Inventory current static truth

Map all static definitions currently under `src/v0/manifest` and adjacent config-like modules:

- item definitions and root/category grouping.
- merge chains and merge behavior.
- producer definitions, activation behavior and output planning.
- stash/container behavior.
- blueprint/building/craft/upgrade rules.
- board/inventory sizes and any constants that are truly game-content config.
- image asset references under `src/assets`/public paths.

Deliverable: a source-to-json mapping note. Do not change runtime yet.

### Phase 2 - Draft canonical schema and source fragment rules

Create a JSON Schema or equivalent schema source for the compiled canonical package plus the allowed source-fragment shape. Prefer boring, explicit validation over clever schema magic.

Schema requirements:

- stable `schemaVersion`.
- strict object keys where practical: no unknown top-level sections unless deliberate.
- unique IDs enforced by object keys.
- reference format conventions documented.
- image asset format documented.
- optional fields minimized; use stable defaults during normalization when possible.
- source fragments may contain any subset of canonical top-level collections.
- duplicate ID behavior is explicit: error by default, patch/override only with an explicit patch mechanism.

Deliverable: schema draft and at least two small hand-authored examples: one single-file package and one split `game.json` + `resources.json` package.

### Phase 3 - CLI validator

Add a CLI validator/compiler that can be run by humans and GPT during development. It must accept multiple JSON files directly, not only one `arkini.json`.

Validator should check more than JSON syntax/schema:

- all references resolve: item ids, asset ids, producer ids, stash ids, loot table ids, product ids, upgrade ids.
- no orphaned critical definitions unless explicitly allowed.
- merge graph sanity: no impossible missing result ids, accidental cycles if cycles are not allowed, duplicate merge pairs.
- loot table sanity: non-empty entries, positive weights, valid item/product references.
- producer/product sanity: referenced products exist, output targets are valid, cooldown/timing values are valid.
- stash/container sanity: capacity/count/rules are valid.
- asset sanity: base64 decodes, mime type matches obvious PNG magic bytes where possible, size/hash optional checks.
- package budget warnings: total JSON bytes, total decoded asset bytes, largest asset.

Deliverable: `npm run game:validate game.json resources.json` or similarly named script that compiles and validates explicit inputs, plus a default-package script for repo checks.

### Phase 4 - Generate default JSON source package

Convert the current TS manifest/config into the first JSON source files. This can be done manually or via a one-off script, whichever is faster and less stupid.

Prefer starting with at least `game.json` and `resources.json` rather than one giant authoring file. One compiled artifact can still be generated later if runtime wants it.

Keep this as content migration only. Runtime still can use the TS config until validation is solid.

Deliverable: default JSON source package committed in a suitable location, likely under `src/v0/manifest/packages/arkini/` or `public/arkini/` depending on the later loading plan.

### Phase 5 - Runtime normalization/loading

Only after schema and validator settle, wire runtime loading.

Possible shape:

1. load default JSON source files or a precompiled package at build time/startup.
2. compile multi-file sources into the canonical package, then validate/normalize it at startup or build/dev time.
3. expose the normalized object through the existing `GameConfig` boundary so the rest of the game changes gradually.
4. keep old TS config temporarily only as migration scaffolding, then delete it.

Loading external/user packages remains TBD.

### Phase 6 - Cleanup and tests

- remove obsolete TS content modules once the JSON package is authoritative.
- add tests for validator failures and normalization.
- keep dependency-cruiser boundaries green.
- update `@chat-gpt/README.md` once this becomes active work.

## Base64 asset decision notes

Inlining small PNG assets as base64 inside JSON is acceptable for the first version if the asset JSON is only a few MB. With source fragments, base64 no longer has to pollute the gameplay/economy file. Benefits:

- one self-contained asset/source package without zip handling.
- no custom zip/container loader yet.
- no asset path management or public folder synchronization.
- easy copy/move/import/export.
- the validator can check the whole game package in one pass.

Drawbacks to account for:

- base64 adds roughly one third size overhead before compression.
- JSON parse has to allocate a large string and the decoded binary later, so peak memory is higher than separate image files.
- any tiny asset change changes the asset JSON file, making diffs ugly and git reviews noisy, but at least it does not touch gameplay/balance files.
- browser caching is all-or-nothing: change one icon and the whole package cache invalidates.
- dev tooling can become unpleasant with multi-MB JSON files.
- decode path is extra work: base64 -> Blob/data URL/image bitmap rather than simple static URLs.
- duplicate assets are easy to accidentally embed unless validator/hash checks catch it.

Practical guideline: inline images are fine while assets are small and resource files stay around a few MB. Add validator warnings before this becomes a trash compactor: warn above ~5 MB per JSON source, warn hard above ~10 MB, and report largest/duplicate assets. A zip/custom package can wait until JSON resources actually hurt.

## Suggested first concrete task

Do Phase 1 only: inventory current static config and propose the first canonical package schema plus multi-file source fragment rules. No runtime loading. No behavior changes. No deleting current TS manifest. This avoids turning one architecture task into six refactors in a trench coat.
