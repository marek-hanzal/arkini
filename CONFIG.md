# Serakki game authoring

This document owns the portable project layout, compiler flow, and author-facing semantic boundaries. [`src/game-value`](src/game-value) owns the foundational immutable scalar language; [`src/game-config-source`](src/game-config-source) owns exact source files, source schemas, and the generated `schema.json`; [`src/game-config`](src/game-config) owns the completed config aggregate; [`src/sfx-event`](src/sfx-event) owns the exact SFX event vocabulary spanning committed gameplay and explicit presentation interactions; [`src/game-config-validation`](src/game-config-validation) owns semantic validation; [`src/game-config-compiler`](src/game-config-compiler) owns canonical compilation; [`GAME.MD`](GAME.MD) owns runtime interpretation.

Project View/Edit includes an **Introduction** section. Optional `game.json.meta.introduction` stores the author's Markdown as packaged game content, separately from Editor Notes. The form starts with 20 lines and grows with its text; View renders Markdown. Empty or whitespace-only text disables the introduction.

## Canonical project

A project is one directly versionable directory:

```text
project.json
schema.json
game.json
items/<uid>.json
artwork/<id>.png
image/<id>.png
music/<id>.ogg
music/<id>.json
sfx/<id>.ogg
sfx/<id>.json
notes/<noteId>.json
```

Only `game.json`, `items/<uid>.json`, `artwork/*.png`, `image/*.png`, `music/*.ogg`, and `sfx/*.ogg` are game sources. The paired `music/<id>.json` and `sfx/<id>.json` files are validated Editor metadata, not gameplay config or packed resources. Project metadata, audio names, Notes, locks, temporary files, and ignored `build/` artifacts never enter Serapacks. Editor Build and `serakki-cli game pack` validate and build the current saved sources directly.

- `project.json` is the root marker and contains Serakki writer provenance plus current project revision.
- `schema.json` is generated from the current source schema and must expose stable root/definition identity.
- `game.json` is the strict complete non-item root and owns `$schema`, package metadata/ID, structured output version, resources, and start state.
- Each item file is a strict `{ $schema, item }` document. Its path owns canonical type and immutable encoded UID; its item owns the human-authored ID.
- `artwork/` contains square Item Artwork. `image/` contains unrestricted-aspect launcher and shell images such as Hero and About avatars. Both accept PNG and share one global resource-ID namespace; the typed root owns semantic type and the filename owns ID. Artwork **Optimize** is an explicit source edit that losslessly re-encodes selected Artwork at its original dimensions; imports never rewrite source bodies automatically. Build bounds only Artwork to square RGBA no larger than 512 × 512; Image bytes and dimensions are preserved.
- `music/` contains the Editor's canonical Ogg/Opus track library. Music shares the global resource-ID namespace; the filename holds its assigned stable ID. `game.json.music.playlist` explicitly selects the unique tracks used by the global random playlist; tracks selected by the playlist or requested by `items/<uid>.json.item.music` enter the Serapack. An item music request stores an exact Music resource ID and does not add that track to the global playlist. Unreferenced tracks remain project sources. The Editor keeps valid Ogg/Opus bytes unchanged, or converts another selected audio format one file at a time through `ffmpeg` when that command exists in `PATH`; conversion trims detected silence from the beginning and end while preserving internal pauses. Music preview is requested lazily from the native file and supports byte ranges; no audio body crosses renderer IPC. Build validates and streams each selected track unchanged into Serapack.
- `sfx/` contains canonical Ogg/Opus sound effects. SFX share the global resource-ID namespace; filenames hold assigned stable IDs. `game.json.sfx.events` maps exact SFX event IDs to resources; the vocabulary includes committed gameplay events, including accepted queue intents, Autofill delivery admission, explicit queue clearing, and an item disappearing without an actually placed lifecycle replacement, plus explicit presentation interactions such as Item Detail opening and closing. Each event has at most one assigned sound, and an event without an assignment remains silent. Presentation interactions trigger audio directly without manufacturing a committed gameplay event. SFX **Optimize** explicitly trims detected silence from existing files one at a time through the same PATH-visible `ffmpeg` pipeline used by conversion; an already clean effect is not re-encoded. Game playback loads and decodes a short effect only when its assigned event occurs; build validates and streams every SFX source unchanged.

- Every Music/SFX body has an adjacent strict `{ "name": "Display name" }` JSON file. The name is non-empty, editable, and need not be unique. Native audio import assigns a fresh ID and initializes a readable name from the source filename; renaming edits metadata only, and Optimize preserves both ID and metadata. Opening or editing metadata never loads or re-encodes audio. Libraries and selectors display/search names while references retain IDs. Missing bodies, missing metadata, or invalid pairs are errors; there is no legacy filename-name reader or automatic migration.
- Portable project export retains both files and their names. Serapacks contain neither audio metadata files nor display names; importing an Serapack creates fresh Editor metadata with an ID-derived initial name. Selected-Music packaging, all-SFX packaging, and lazy native streaming remain unchanged. Music/SFX detail pages expose View, Edit, and Delete; deletion shows usage and removes the pair through existing project write serialization and reference cleanup.

There is no free-form recursive JSON-fragment grammar. JSON outside the exact root and item paths is excluded from gameplay assembly; audio sidecars have their own strict metadata validation, and a missing/invalid marker, schema, root, path identity, or reference is a diagnostic.

## Compile and pack

Every consumer uses one pipeline:

```text
read marker + schema + exact source paths
→ strict source parsing with provenance
→ deterministic root/item assembly
→ completed GameConfig parse
→ semantic and PNG-resource validation
→ assert no errors
→ bounded square RGBA normalization for `artwork/`; byte-preserving staging for `image/`, Music, and SFX
→ validate staged resource bytes and pack those same owned files
→ JSON manifest + JSON GameConfig + ordered raw resource bodies, with Music filtered by the authored playlist and item detail requests, and SFX event assignments preserved
→ SERAPACK envelope with optional distribution proof
```

Validation, Editor Build, tests, and packing must not assemble their own variation. Conflicts never silently overwrite another provider; diagnostics retain the owning source path.

Product commands are:

```bash
serakki-cli game schema [--output path]
serakki-cli game validate [project] [--silent]
serakki-cli game pack [project] [--silent]
serakki-cli game replay --incident <latest-directory> --until-fatal [--timeout-ms 10000]
serakki-cli game replay --serapack <file> --save <file> --until-fatal [--timeout-ms 10000]
serakki-cli diagnostics slice <incident-or-jsonl-path> [--session-id <jsonl-session-id>] [--section all|summary|failure|history|runtime]
```

Replay assumes the supplied Serapack has already passed the canonical build path, decodes its current artifact and save contracts, and runs the real production `GameSession` without touching installed saves. The incident form resolves the fixed `game.serapack` and `save.serasave` files. Its bounded text report distinguishes a reproduced fatal failure from a timeout, includes semantic history, and compares the initial and final runtime without dumping duplicate complete states. The common rotating diagnostic directory contains human-readable application runtime and fatal history in `application.md` beside the private gameplay session stream in `diagnostics.jsonl`. Every application record carries severity, the `package.json` application version, packaged/development mode, platform, and architecture; any bounded normalization or final text truncation is visible in the record. Diagnostic slicing defaults to the latest failed gameplay session, accepts the fixed text incident or that rotating JSONL stream, reports malformed input without physical paths, and renders only stable human/LLM-readable text. `--session-id` selects only JSONL sessions; `--section runtime` reads only the fixed incident's complete runtime projection. The fixed incident directory links `incident.md`, `failure.md`, `history.md`, and `runtime-state.md`; Item references include runtime ID, authored ID, and immutable configured UID whenever resolution is possible.

The repository wrappers are `argc game:schema`, `argc build`, and `argc check`. Run schema generation after a source-schema change, validation after content/resource changes, and packing only through the canonical command. Packing validates again, streams `<project>/build/<encoded projectId>.serapack`, and replaces the prior build; ordinary local and Editor builds are Community. Item Artwork from `artwork/` is compiled to square RGBA no larger than 512 × 512 pixels without enlarging smaller artwork. General PNGs from `image/` retain their exact source bytes and dimensions.

`game validate` and `game pack` accept `--silent` to hide warning diagnostics while preserving errors and normal command results. `argc check --silent` forwards that policy to the bundled game pack; every other repository check remains unchanged.

Repository builds and previews skip packing an unchanged official game through `Argcfile.sh`. `argc serapack-fingerprint` uses the mise-pinned Coreutils SHA-256 implementation to hash sorted relative paths and raw file bytes: game JSON and PNG sources, project/schema markers, the conservative `src`, `shared`, `electron` and `scripts` source trees, dependency manifests, TypeScript/build configuration and toolchain pins. The generated route tree, Notes and build output are excluded; platform and architecture are included. The project manifest is parsed with the existing Node runtime and hashed with its valid Editor revision normalized to zero; its format version and any other fields remain inputs. Revision-only saves therefore preserve the cache. The conservative source trees still allow harmless rebuilds after unrelated code changes instead of maintaining an import graph. Images are read for hashing but are not decoded or normalized on a cache hit.

The disposable `game/serakki/build/serakki.serapack.cache` contains the source fingerprint and complete Serapack checksum. Reuse requires both to match and no active Editor write lock. Provenance verification still runs; missing or damaged records/artifacts rebuild. Repository and prerelease GHA checks cache that build directory under the same fingerprint, then run their normal gates. Release signing always rebuilds; release packaging retains the existing verified prebuilt-artifact flow. Direct CLI packing and Build inside the Editor retain their existing behavior.

[`Argcfile.sh`](Argcfile.sh) `version` updates `package.json`, `package-lock.json`, and the official `project.json.serakki` writer stamp as one repository operation.

## Identity and references

All exact IDs use [`src/game-value/schema/IdSchema.ts`](src/game-value/schema/IdSchema.ts); prefixes are human naming conventions, not new value schemas. References are explicit and are never derived from filenames or title conventions.

There is one Item schema, without an item-type discriminator. Authoring uses `create_item`, `edit_item`, and the exact-line `create_item_line`, `replace_item_line`, and `delete_item_line`; item files live directly in `items/`. Line writes require the project revision from a preceding read, preserve unrelated item values, and use the same repository revision checks. Create appends a complete line and rejects an existing ID; replace and delete preserve the remaining line order and reject missing or ambiguous IDs. `item_line_order` accepts a revision-pinned exact permutation of every existing line ID and changes only their order; incomplete lists, unknown IDs, duplicate requested IDs and ambiguous existing IDs are rejected before any write.

`edit_item_lines` batches 1–20 create/replace/delete operations across items using one snapshot and expected project revision. Each item/line pair may appear once. It shares exact-line mutation rules with the single-line tools, validates completed items before one best-effort repository commit, and publishes one revision and notification. Invalid operations or stale revision reject the whole batch before writing; persistence retains the existing best-effort file-plan contract.

MCP `item_detail` includes the project revision for lightweight authoring reads. `item_lines` returns ordered authored line identities and behavior flags, while `item_line_configs` returns canonical configs for up to 50 unique item/line pairs from one snapshot. Batch line reads preserve first-request order, deduplicate pairs, and explicitly report missing items, missing lines and ambiguous line IDs.

Item `uid` is immutable filesystem identity generated at creation and survives authored-ID renames, import/export and Serapack rebuilds. Item `id` is the readable gameplay identity referenced by config. Validation rejects duplicate IDs/UIDs and disagreement between item UID and its path.

MCP `rename_item` selects the current `itemId` and accepts optional `title` and `id` (at least one required). `title` changes only the item. Optional `artwork: true` requires `id` and exactly one existing Artwork in `artwork.default`; it renames that resource to the supplied ID, updating every exact resource reference and linked Note. A target resource-ID collision rejects the entire operation. Item/config and optional PNG/Note changes share one revision-guarded repository write under the project lock with atomic individual file replacements; item UID remains stable. There is no aggregate rollback: an I/O failure may leave a partial tree.

The package ID has one owner: `game.json` `meta.id`. Catalogs, paths, manifests, and artifacts derive or verify it rather than copying a competing identity.

Renaming `meta.id` creates a different game namespace: existing installed saves remain associated with the old package ID. The Editor preserves output version settings, current source and Notes.

## Authoring semantics

Exact Item capabilities, line/input/rule/output shapes, conditions, rolls, and fields come from `schema.json`. Important cross-field rules are:

The canonical immutable Item vocabulary lives in [`src/item-definition`](src/item-definition): Item schema identities, bounded quantities, selectors, and total selection policy over explicit definitions. Authored query distance schemas and canonical Runtime Item query execution live together in `src/item-query`; canonical aggregate reads remain in `src/game-runtime`, while drop/write plus ordinary click reads live in `src/item-interaction`. `SpaceActionSchema` remains with the Space action that interprets it, while `item-action` owns the discriminated action contract, game metadata remains in `src/game-config`.

- every item requires finite `artwork.scale` from `0.25` through `1`; new Editor drafts explicitly start at `1`. This ratio scales the complete artwork canvas, including both default layers, inside an unchanged full tile. `1` fills the tile canvas; transparent PNG padding still affects visible subject size. The Artwork form previews the authored ratio against a tile frame. Game and Editor Board share it; occupancy, hit geometry, interaction reach, image resolution and transient container motion do not change;
- Board query distance uses Chebyshev reach within the origin Space: `self` is 0, `close` is exactly 1, `near-close` is 1 or 2, `near` is exactly 2, and `far` is any positive distance. Diagonals count; every distance except `self` excludes the origin;
- items have no storage scope: all physical grid placement is on a Board. Queries contain a selector and one required `distance`: `self`, `close`, `near-close`, `near`, `far`, or `universe`. The first five use the physical origin Board; `universe` searches all Board spaces, including the origin;
- Board-relative rule conditions require a physical Board origin. Clock timers and expiry outputs use the same rule interpretation;
- every start-Board coordinate and current Board selection has explicit `space`; no default or cross-space inference exists;
- item definitions have no global instance-count cap; use query conditions such as `exists` or `count` in production rules to control availability;
- runtime purity and stack eligibility are derived state, never an authored flag;
- item `draft` is optional in source, defaults to `false` when omitted, and is only an Editor authoring status with no gameplay or Build filtering semantics;
- An item has `lines` defaulting to an empty array and `maxQueueSize` defaulting to one. Items without lines cannot run production; adding lines enables the ordinary production contract. An item with `clock` may also have no lines;
- An item may author one optional `action` of type `space` with its target `space`, and optional `input` and `rules` collections defaulting to empty. Action rules alone determine click availability; no `enable` field exists. An occupied `space` action target is a directional portal drop target: it moves the exact source stack to the first free cell on the authored Board before input, merge, stack or swap resolution, without activating the action or changing the current space;
- canonical Item validation rejects simultaneous `action` and nonempty `lines`. Editor capability switches clear the opposing capability in one form update with advance help; JSON and MCP reject conflicting data without silently deleting authored fields;
- line input is passive; Enqueue and Tick own execution;
- material inputs require `query` (selector plus Autofill scope, and distance for Board); there is no implicit scope or legacy top-level selector. Manual delivery uses its selector without the Autofill reach restriction;
- material selectors may name any canonical item, including Clock identities whose interval and lifetime continue advancing in input and job storage while their Clock rules permit time;
- each material input stores at most its authored `quantity.max`; there is no extra input capacity;
- `units` defines a finite supply inside each item instance (health, resource stock, or uses), separately from stack `quantity`: passive and manually operated resources use ordinary items; scheduled production adds Item.clock;
- `self` unit costs use the line owner, while `target` is valid only for a units input and its deterministic Board payer (including an owner with units selected at self distance);
- outputs author ordinary `drop` or `random` Board strategy; there is no hidden replacement-output mode. Every output set owns explicit `rules`: set rules filter the pool before weights are summed, while individual drop rules remain post-selection gates and never cause a replacement draw. An output selects one available set; its rolls are Guaranteed or Chance groups, never nested weighted draws;
- directional merge rules belong to the source item and never imply a reverse rule;
- optional item `clock` groups optional `intervalMs`, optional `durationMs`, optional `expiryMode`, `enable`, `rules`, and `onExpire`. At least one timer is required. It requires `maxStackSize: 1` and no Action; lines may be empty. Both timers advance for the exact runtime identity while Clock rules permit time, including while an item is owned by input, a job, or a delivery. A periodic pulse outside Board cannot admit Board-owned production or create catch-up work. Its authored `enable` defaults to true; missing duration means unlimited active lifetime. Missing interval gives a one-shot lifetime without pulses. The Editor exposes both timers as optional fields and offers expiry output only with a lifetime;
- `clock.expiryMode` is `loose-kill` (also the meaning of omission) or `kill-switch`, and matters only with a finite lifetime. Loose-kill waits for accepted production to settle, including output placement. Kill-switch cancels queued and active work and removes the owner atomically: reserved items are placed first, then unused input materials, then the normally resolved Clock expiry output. Placement follows ordinary storage and stack limits; anything that cannot fit is lost and recorded in gameplay events. Consumed active-job inputs remain consumed, spent units are not refunded, and canceled jobs emit no line output. Incoming deliveries return through their ordinary return path. Jobs already completed at the same Tick boundary retain their completion precedence.
- Item `ui` is `simple` or `default` (default `default`). Simple shows only item information, hiding Lines; Default shows Lines followed by item information in one scrollable detail without tabs. Both interfaces allow Board clicks to enqueue the effective Default line, including queue fill. Without a Default line, no click production is available. Simple still denies direct line commands, input management, other queue changes and line selection; Default permits ordinary manual production. Clock, Action, movement and merge policies remain independent;
- line `default` selects one manual line; optional `clock` independently includes any number of lines in periodic selection. `clockWeight` is an integer from 1 to 999, default 1. Editor Default selection clears sibling Default flags; Clock flags are independent. Each pulse evaluates line rules before building its enabled weighted pool, ignores visibility, and draws one line without retrying if ordinary admission rejects it. An empty pool still ages normally and creates no work;
- a capability, field, or schema variant is not runtime-backed until an owned command/Tick path and focused behavior proof implement it.

Do not repeat field catalogs in prose or weaken a schema to silence malformed data. Change the owning schema/behavior together and regenerate the project schema.

Production lines may optionally reference one Artwork resource through `line.artwork`. The Editor provides an optional Artwork selector; Game Lines and the Editor production detail show the selected image beside the line title. An omitted reference renders no image or placeholder. The reference participates in typed resource validation, usage/deletion checks and resource rename; it has no effect on production behavior. Existing item files need no update.

Item artwork currently uses its authored default composition and scale throughout runtime. Progress-based artwork selection is deferred to [issue #725](https://github.com/marek-hanzal/serakki/issues/725).

## Validation

Validation extends beyond Zod shape parsing. It owns source/path identity, duplicate providers and records, reference integrity, semantic relationships/cycles, unit payer and affordability constraints, scope/capability compatibility, resource existence/usage, completed config, and other runtime preconditions. Diagnostics preserve source and entity provenance. Finite items without a configured recreation path, or with only stochastic recreation, receive non-blocking unit-renewal warnings for every item.

The compiler must reject an invalid project without producing a usable artifact.

## Editor sidecars

Notes are stored once in `notes/<noteId>.json` with Markdown content, ordering/freshness timestamps, and optional unique `itemUids` and `resourceIds` arrays. Missing link arrays normalize to `[]`; a note is globally unlinked only when both arrays are empty. Item links use immutable UIDs, while Resource links use the current canonical resource IDs. The global Notes route and every Item or Artwork detail Notes tab share one composer/list; authoring forms do not expose Notes. Create/edit validates both relationship sets against the open project and guards updates by `expectedUpdatedAtMs`. Item deletion strips absent UIDs, and resource rename/delete rewrites affected resource IDs in the same ordered best-effort file plan while preserving the note and advancing its freshness.

Notes are portable but do not change authoring revision and do not enter Build or Serapack output. The live Editor Board is ephemeral: named scenarios and internal project history are not supported. Use Git to version the portable project.

The project stores `game.json.version` as `{ major, minor, suffix? }`, the last manually chosen Serapack output version. Major and minor are nonnegative safe integers; the optional suffix starts with an ASCII letter or digit and then permits ASCII letters, digits, dots and hyphens. Fresh projects start at `{ major: 1, minor: 0 }`. Build saves valid version settings before compilation, retaining them on failure without changing authoring revision or the live Board. Ordinary authoring and package-ID rename preserve these settings. CLI uses the same saved fields; compilation formats them as `major.minor[-suffix]`. Serapack import parses that external string once. Authors decide compatibility; no content diff or automatic bump exists.

Editor operations use the same directory, schemas, validation, compiler, and packer as the CLI. JSON import opens or creates this exact format; export creates a new unique child, copies only portable allowlisted paths, validates it, and never overwrites an existing destination. External project roots preserve `.git` and unrelated files.

`src/artwork-authoring` owns the Artwork catalog, square-PNG admission, import/edit/delete sessions, Optimize, and presentation. Project Images owns general-PNG import and launcher/shell mappings. `src/audio-authoring` owns shared Music/SFX library import, lazy one-track preview and canonical Ogg/Opus preparation; noncanonical input conversion depends only on a PATH-visible `ffmpeg`. `src/music-authoring` owns random-playlist selection over that shared audio surface, while `src/sfx-authoring` owns event assignment over the Sound-effects workspace and `src/sfx-event` owns the assignable vocabulary. `src/resource-authoring` owns shared typed import orchestration; `src/authoring-session` owns mounted-project resource URLs; `src/authoring-form` owns the typed Resource-reference control. `src/game-config-resource` owns the generic Resource schema, semantic type, exact source discovery, PNG and Ogg/Opus admission, references, usage, and rename semantics. Explicit non-item Image roles, the global Music playlist, and exact SFX event assignments belong to the completed `src/game-config` value they populate.

## Content workflow

```text
edit the smallest owning root/item/resource
→ regenerate schema if contracts changed
→ validate
→ run focused behavioral tests when semantics changed
→ run the closing repository gate required by risk
```
