# JSON game definition package plan - 2026-06-17

Status: TODO

## Product goal

Move Arkini static game content/rules toward JSON-authored game packages with one canonical final shape in memory, but many possible source fragments during authoring. This is a structural/content authoring change, not a TileEngine or UI rewrite.

The default Arkini source package should live at repo root under `./game/arkini/`. The game package source may contain any number of JSON fragments plus raw PNG resources under `./game/arkini/assets/`. A compile step turns that folder into one canonical `ArkiniGamePackage` JSON that the app can use during dev/build.

The intended end state is:

```txt
./game/arkini/              # human/GPT authoring source
  game.json                 # one possible gameplay fragment
  items/*.json              # optional finer fragments
  lootTables/*.json         # optional finer fragments
  assets/*.png              # raw source PNGs; replaces src/assets over time

npm run game:compile ./game/arkini
  -> compiled canonical ArkiniGamePackage JSON

npm run game:validate game.json resources.json
  -> validate explicit source fragments when needed
```

Runtime save state remains separate. The package describes static game truth only.

Runtime loading is still not the first task. First settle source layout, canonical shape, compiler/validator semantics, and default package generation. Then wire the app to consume the compiled default package through the existing `GameConfig`/normalization boundary.

## Why this exists

Current v0 is already mostly data-driven, but the data still lives in TypeScript modules. That preserves TS types, but it makes broad game-design/content work expensive because the model has to keep navigating code-shaped config files. The new direction deliberately trades compile-time config typing for JSON source files plus a CLI compiler/validator that gives fast feedback during development. Yes, we are replacing TypeScript confidence with tooling discipline; civilization continues its proud tradition of moving problems sideways.

The authoring split is intentional: resources/assets can live outside gameplay/economy fragments, so content work can keep generated `resources` noise out of context while editing item/economy/loot JSON. Later, item groups, upgrades, loot tables, balance patches or experiment overrides can live in their own fragments too.

## Core architecture direction

Use top-level collections keyed by stable IDs. Avoid nested domain objects that make reuse and validation harder.

There is one canonical final shape, but no requirement that authoring uses one physical file. The compiler/loader API should be conceptually boring:

```ts
load([json1, json2, json3]) -> ArkiniGamePackage
```

Each JSON source file may contain any subset of the canonical shape. A tiny one-file package is valid. A split package like `game.json` + `resources.json` is valid. A more granular package like `items.wood.json` + `lootTables.early.json` + `resources.icons.json` is valid. A small patch file that modifies one loot table can also be valid once patch semantics are explicitly defined.

The folder compiler is just a convenience over the same source-fragment compiler:

```ts
compileDirectory("./game/arkini") -> ArkiniGamePackage
```

It should recursively load every JSON file in the folder and add one generated resource fragment from PNGs found under `assets/`.

Expected package sections, names still negotiable:

- `meta`: package id, name, version, schema version, build notes.
- `resources`: binary/image resource definitions keyed by resource id. For PNG source assets, keep the JSON shape intentionally stupid: `{ "data": "...base64..." }`. No hand-authored MIME field, dimensions, or ceremony unless we later prove we need that nonsense.
- `items`: every item definition keyed by item id.
- `producers`: producer behavior definitions keyed by producer id.
- `stashes`: stash/container behavior definitions keyed by stash id.
- `lootTables`: reusable weighted output tables keyed by loot table id.
- `products`: reusable producer/product definitions keyed by product id. Producer outputs should reference product ids, not inline output objects.
- `mergeRules`: merge relationships keyed or listed with input/result ids.
- `upgrades`: upgrade/building/blueprint relationships keyed by upgrade id.
- `recipes`: craft/build recipes if/when separated from upgrades.
- `board`, `inventory`, `economy`, `timing`, `uiHints`: only if the current TS manifest actually needs these concepts represented outside code.

Everything cross-links by ID. Example: an item references `resourceId`, a producer references `productIds` or a loot table id, a loot table references item ids or product ids, upgrade rules reference item/building ids. Avoid embedding full item/product/loot objects inside each other.

## Default package source layout

Default authoring source should be rooted outside `src`:

```txt
./game/arkini/
  game.json
  items/
    natural.json
    buildings.json
  producers.json
  lootTables.json
  upgrades.json
  assets/
    item-twig.png
    item-stick.png
    building-camp.png
```

`src/assets` should disappear for game item/content PNGs once this migration lands. Source PNGs belong to the game package under `./game/arkini/assets`. App-only UI assets can remain elsewhere if they are not part of the game package.

Resource generation rule for the first version:

- scan `./game/arkini/assets/**/*.png`.
- create resource id from file basename without extension, e.g. `item-twig.png` -> `item-twig`.
- generate a resource entry as `{ "data": "<base64>" }`.
- fail on duplicate generated resource ids. If we later need nested folders to disambiguate, we can switch to path-based ids deliberately instead of pretending collisions are fine.
- validator/compiler can still check PNG magic bytes by decoding base64; the JSON authoring shape does not need to carry `mime` just so humans can type `image/png` until the heat death of the universe.

Generated resource fragments are build artifacts, not something GPT/humans should edit by hand.

## Source fragments and merge semantics

The manifest file is optional convenience only, not the foundation. The validator/compiler must accept explicit files directly:

```bash
npm run game:validate game.json resources.json
npm run game:validate game.json resources.json loot-overrides.json
```

The default-package compile path should accept a folder:

```bash
npm run game:compile ./game/arkini
npm run game:validate:default
```

`game:compile` should recursively read JSON fragments from the folder and generate resources from `assets/**/*.png`. This gives us a canonical compiled package for dev/build without forcing the app to understand every authoring file split.

Possible manifest support can come later as a shortcut for authored packages, but the core API should not require it. Browser/manual import can expose multiple file inputs or one multi-file upload and pass parsed JSON objects to the same compiler. Directory upload can be a later nicety, not a first-version dependency.

Initial merge semantics should be conservative and easy to explain:

- top-level object collections merge by key.
- duplicate IDs are errors by default, because silent overwrite is how config systems become crime scenes.
- patch/override files must opt in explicitly, e.g. via a top-level `patches` section or source metadata, before replacing existing keys.
- arrays should be avoided for ID-addressable definitions; use keyed objects so merge paths are stable.
- validation runs after compilation against the final canonical package, but errors should report the original source file and JSON path where practical.

## Compiler/build contract

`game:compile` is the default package build step. It should be usable in local dev and as part of production build:

```bash
npm run game:compile ./game/arkini
npm run build
```

Expected compile responsibilities:

1. recursively discover JSON source fragments in the input directory.
2. parse them with source filename/path tracking.
3. scan `assets/**/*.png` and synthesize a resources fragment.
4. merge fragments into one canonical `ArkiniGamePackage` object.
5. validate the compiled package.
6. write a generated canonical JSON artifact for the app/dev tooling to consume.

The exact generated output path can be finalized during implementation. Keep these principles:

- the compiled file is generated and should not become the human editing surface.
- the app should consume the compiled canonical package, not walk the source folder at runtime.
- production build should either run `game:compile` before bundling or fail clearly if the compiled package is missing/stale.
- dev should have a cheap command to recompile after JSON/PNG changes.

## Critical boundaries to preserve

- The JSON package describes game content and rules. It must not contain mutable save state.
- TileEngine stays generic and must not know this schema directly.
- Runtime domain code may normalize validated JSON into whatever internal read model is convenient, but the package file itself should stay authoring-friendly and ID-linked.
- No server dependency. Arkini remains a client-only/offline SPA.
- Engine/runtime code consumes only the compiled canonical package. It must not care whether the source came from one JSON file, several uploaded files, a root folder compile, a manifest, OPFS, or some other future packaging nonsense.
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

Deliverable: a source-to-json mapping note plus the proposed `./game/arkini` authoring layout. Do not change runtime yet.

### Phase 2 - Draft canonical schema and source fragment rules

Create a JSON Schema or equivalent schema source for the compiled canonical package plus the allowed source-fragment shape. Prefer boring, explicit validation over clever schema magic.

Schema requirements:

- stable `schemaVersion`.
- strict object keys where practical: no unknown top-level sections unless deliberate.
- unique IDs enforced by object keys.
- reference format conventions documented.
- resource format documented as simple `{ data: base64 }` for generated PNG resources.
- optional fields minimized; use stable defaults during normalization when possible.
- source fragments may contain any subset of canonical top-level collections.
- duplicate ID behavior is explicit: error by default, patch/override only with an explicit patch mechanism.

Deliverable: schema draft and at least two small hand-authored examples: one single-file package and one split gameplay/resources package.

### Phase 3 - CLI validator/compiler

Add a CLI validator/compiler that can be run by humans and GPT during development. It must accept multiple JSON files directly and a default folder compile, not only one `arkini.json`.

Validator should check more than JSON syntax/schema:

- all references resolve: item ids, resource ids, producer ids, stash ids, loot table ids, product ids, upgrade ids.
- no orphaned critical definitions unless explicitly allowed.
- merge graph sanity: no impossible missing result ids, accidental cycles if cycles are not allowed, duplicate merge pairs.
- loot table sanity: non-empty entries, positive weights, valid item/product references.
- producer/product sanity: referenced products exist, output targets are valid, cooldown/timing values are valid.
- stash/container sanity: capacity/count/rules are valid.
- resource sanity: base64 decodes, PNG magic bytes match for generated PNG resources, duplicate image hashes are reported.
- package budget warnings: total JSON bytes, total decoded resource bytes, largest resource.

Deliverables:

```bash
npm run game:validate game.json resources.json
npm run game:compile ./game/arkini
npm run game:validate:default
```

### Phase 4 - Generate default JSON source package

Convert the current TS manifest/config into the first `./game/arkini` JSON source folder. This can be done manually or via a one-off script, whichever is faster and less stupid.

Move game-content PNGs out of `src/assets` into `./game/arkini/assets`. Add the compiler step that turns those PNGs into generated `{ resourceId: { data } }` entries.

Keep this as content migration first. Runtime can still use the TS config until validation/compiler output is solid.

Deliverable: default JSON source package committed under `./game/arkini/`, plus generated compiled package output if the implementation chooses to commit generated output.

### Phase 5 - Runtime normalization/loading

Only after schema, compiler and validator settle, wire runtime loading.

Possible shape:

1. production/dev build runs `game:compile ./game/arkini`.
2. app imports or fetches the generated canonical package.
3. expose the normalized object through the existing `GameConfig` boundary so the rest of the game changes gradually.
4. keep old TS config temporarily only as migration scaffolding, then delete it.

Loading arbitrary external/user packages remains later work. Manual import can accept multiple JSON files and call `load([json1, json2, ...])`; it does not need manifest support.

### Phase 6 - Cleanup and tests

- remove obsolete TS content modules once the JSON package is authoritative.
- delete/retire `src/assets` entries that are now game package resources.
- add tests for validator failures, folder compilation, PNG resource generation and normalization.
- keep dependency-cruiser boundaries green.
- update `@chat-gpt/README.md` once this becomes active work.

## Base64 resource decision notes

Inlining small PNG resources as base64 inside generated JSON is acceptable for the first version if the resource JSON is only a few MB. With source fragments and auto-generation, base64 no longer has to pollute the gameplay/economy files. Benefits:

- raw PNGs remain normal files under `./game/arkini/assets` during authoring.
- humans/GPT do not hand-edit base64.
- no custom zip/container loader yet.
- no `src/assets` synchronization for game content.
- easy copy/move/import/export of a compiled package when needed.
- the validator can check the whole game package in one pass.

Drawbacks to account for:

- base64 adds roughly one third size overhead before compression.
- JSON parse has to allocate a large string and the decoded binary later, so peak memory is higher than separate image files.
- any tiny resource change changes the generated resource JSON/compiled package, making generated diffs ugly if we commit them.
- browser caching is all-or-nothing if the app consumes one compiled package.
- dev tooling can become unpleasant with multi-MB generated JSON files, so do not make generated resources the normal editing surface.
- decode path is extra work: base64 -> Blob/data URL/image bitmap rather than simple static URLs.
- duplicate resources are easy to accidentally embed unless validator/hash checks catch it.

Practical guideline: raw PNG source files plus generated base64 resources are fine while assets are small and generated package files stay around a few MB. Add validator warnings before this becomes a trash compactor: warn above ~5 MB per generated package/resource output, warn hard above ~10 MB, and report largest/duplicate resources. A zip/custom package can wait until generated JSON resources actually hurt.

## Suggested first concrete task

Do Phase 1 only: inventory current static config/assets and propose the first canonical package schema plus `./game/arkini` source layout and `game:compile` output contract. No runtime loading. No behavior changes. No deleting current TS manifest yet. This avoids turning one architecture task into six refactors in a trench coat.
