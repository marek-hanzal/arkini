# JSON game definition package plan - 2026-06-17

Status: TODO

## Product goal

Move Arkini static game content/rules toward one complete external JSON package, tentatively `arkini.json`, that the client game can load as its default built-in definition. This is a structural/content authoring change, not a TileEngine or UI rewrite.

The intended end state is a standalone game package that contains all static gameplay truth in one file, including small PNG/SVG-like image assets encoded inline, so the engine can consume the package and render/play that definition. The default Arkini package should ship with the app and be loaded by the game. Runtime save state remains separate.

JSON loading is explicitly TBD for the first pass. Do not start by wiring runtime loading into the app. First settle schema shape, then validation, then the loading/normalization path.

## Why this exists

Current v0 is already mostly data-driven, but the data still lives in TypeScript modules. That preserves TS types, but it makes broad game-design/content work expensive because the model has to keep navigating code-shaped config files. The new direction deliberately trades compile-time config typing for a single authorable JSON package plus a CLI validator that gives fast feedback during development. Yes, we are replacing TypeScript confidence with tooling discipline; civilization continues its proud tradition of moving problems sideways.

## Core architecture direction

Use top-level collections keyed by stable IDs. Avoid nested domain objects that make reuse and validation harder.

Expected package sections, names still negotiable:

- `meta`: package id, name, version, schema version, build notes.
- `assets`: inline image definitions keyed by asset id, likely `{ mimeType, base64, width?, height?, hash? }`.
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

## Critical boundaries to preserve

- The JSON package describes game content and rules. It must not contain mutable save state.
- TileEngine stays generic and must not know this schema directly.
- Runtime domain code may normalize validated JSON into whatever internal read model is convenient, but the package file itself should stay authoring-friendly and ID-linked.
- No server dependency. Arkini remains a client-only/offline SPA.
- Default package loading can be static/import-based initially. User-supplied package loading is a later concern unless explicitly requested.
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

### Phase 2 - Draft `arkini.schema.json` shape

Create a JSON Schema or equivalent schema source for the external package. Prefer boring, explicit validation over clever schema magic.

Schema requirements:

- stable `schemaVersion`.
- strict object keys where practical: no unknown top-level sections unless deliberate.
- unique IDs enforced by object keys.
- reference format conventions documented.
- image asset format documented.
- optional fields minimized; use stable defaults during normalization when possible.

Deliverable: schema draft and one small hand-authored JSON example.

### Phase 3 - CLI validator

Add a CLI validator for `arkini.json` that can be run by humans and GPT during development.

Validator should check more than JSON syntax/schema:

- all references resolve: item ids, asset ids, producer ids, stash ids, loot table ids, product ids, upgrade ids.
- no orphaned critical definitions unless explicitly allowed.
- merge graph sanity: no impossible missing result ids, accidental cycles if cycles are not allowed, duplicate merge pairs.
- loot table sanity: non-empty entries, positive weights, valid item/product references.
- producer/product sanity: referenced products exist, output targets are valid, cooldown/timing values are valid.
- stash/container sanity: capacity/count/rules are valid.
- asset sanity: base64 decodes, mime type matches obvious PNG magic bytes where possible, size/hash optional checks.
- package budget warnings: total JSON bytes, total decoded asset bytes, largest asset.

Deliverable: `npm run validate:game-config` or similarly named script that validates the default package.

### Phase 4 - Generate default `arkini.json`

Convert the current TS manifest/config into a first JSON package. This can be done manually or via a one-off script, whichever is faster and less stupid.

Keep this as content migration only. Runtime still can use the TS config until validation is solid.

Deliverable: default `arkini.json` committed in a suitable location, likely under `src/v0/manifest/packages/arkini.json` or `public/arkini.json` depending on the later loading plan.

### Phase 5 - Runtime normalization/loading

Only after schema and validator settle, wire runtime loading.

Possible shape:

1. import default `arkini.json` at build time.
2. validate/normalize it at startup or build/dev time.
3. expose the normalized object through the existing `GameConfig` boundary so the rest of the game changes gradually.
4. keep old TS config temporarily only as migration scaffolding, then delete it.

Loading external/user packages remains TBD.

### Phase 6 - Cleanup and tests

- remove obsolete TS content modules once the JSON package is authoritative.
- add tests for validator failures and normalization.
- keep dependency-cruiser boundaries green.
- update `@chat-gpt/README.md` once this becomes active work.

## Base64 asset decision notes

Inlining small PNG assets as base64 inside JSON is acceptable for the first version if the package is only a few MB. Benefits:

- one self-contained game package file.
- no custom zip/container loader yet.
- no asset path management or public folder synchronization.
- easy copy/move/import/export.
- the validator can check the whole game package in one pass.

Drawbacks to account for:

- base64 adds roughly one third size overhead before compression.
- JSON parse has to allocate a large string and the decoded binary later, so peak memory is higher than separate image files.
- any tiny asset change changes the giant JSON file, making diffs ugly and git reviews noisy.
- browser caching is all-or-nothing: change one icon and the whole package cache invalidates.
- dev tooling can become unpleasant with multi-MB JSON files.
- decode path is extra work: base64 -> Blob/data URL/image bitmap rather than simple static URLs.
- duplicate assets are easy to accidentally embed unless validator/hash checks catch it.

Practical guideline: inline images are fine while assets are small and the package stays around a few MB. Add validator warnings before this becomes a trash compactor: warn above ~5 MB JSON, warn hard above ~10 MB, and report largest/duplicate assets. A zip/custom package can wait until the single-file JSON actually hurts.

## Suggested first concrete task

Do Phase 1 only: inventory current static config and propose the first package schema. No runtime loading. No behavior changes. No deleting current TS manifest. This avoids turning one architecture task into six refactors in a trench coat.
