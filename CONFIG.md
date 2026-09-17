# Arkini game authoring

This document owns the portable project layout, compiler flow, and author-facing semantic boundaries. [`src/game-value`](src/game-value) owns the foundational immutable scalar language; [`src/game-config-source`](src/game-config-source) owns exact source files, source schemas, and the generated `schema.json`; [`src/game-config`](src/game-config) owns the completed config aggregate; [`src/sfx-event`](src/sfx-event) owns the exact SFX event vocabulary spanning committed gameplay and explicit presentation interactions; [`src/game-config-validation`](src/game-config-validation) owns semantic validation; [`src/game-config-compiler`](src/game-config-compiler) owns canonical compilation; [`GAME.MD`](GAME.MD) owns runtime interpretation.

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
sfx/<id>.ogg
notes/<noteId>.json
```

Only `game.json`, `items/<uid>.json`, `artwork/*.png`, `image/*.png`, `music/*.ogg`, and `sfx/*.ogg` are game sources. Project metadata, Notes, locks, temporary files, and ignored `build/` artifacts are never compiled. Editor Build and `arkini-cli game pack` validate and build the current saved sources directly.

- `project.json` is the root marker and contains Arkini writer provenance plus current project revision.
- `schema.json` is generated from the current source schema and must expose stable root/definition identity.
- `game.json` is the strict complete non-item root and owns `$schema`, package metadata/ID, structured output version, resources, and start state.
- Each item file is a strict `{ $schema, item }` document. Its path owns canonical type and immutable encoded UID; its item owns the human-authored ID.
- `artwork/` contains square Item Artwork. `image/` contains unrestricted-aspect launcher and shell images such as Hero and About avatars. Both accept PNG and share one global resource-ID namespace; the typed root owns semantic type and the filename owns ID. Artwork **Optimize** is an explicit source edit that losslessly re-encodes selected Artwork at its original dimensions; imports never rewrite source bodies automatically. Build bounds only Artwork to square RGBA no larger than 256 × 256; Image bytes and dimensions are preserved.
- `music/` contains the Editor's canonical Ogg/Opus track library. Music shares the global resource-ID namespace and derives its ID from the filename. `game.json.music.playlist` explicitly selects the unique tracks used by the global random playlist; only those selected tracks enter the current Arkpack. Unselected tracks remain project sources for later explicit authored use. The Editor keeps valid Ogg/Opus bytes unchanged, or converts another selected audio format one file at a time through `ffmpeg` when that command exists in `PATH`; conversion trims detected silence from the beginning and end while preserving internal pauses. Music preview is requested lazily from the native file and supports byte ranges; no audio body crosses renderer IPC. Build validates and streams each selected track unchanged into Arkpack.
- `sfx/` contains canonical Ogg/Opus sound effects. SFX share the global resource-ID namespace and derive IDs from filenames. `game.json.sfx.events` maps exact SFX event IDs to resources; the vocabulary includes committed gameplay events, including accepted queue intents, explicit queue clearing, and an item disappearing without an actually placed lifecycle replacement, plus explicit presentation interactions such as Item Detail opening and closing. Each event has at most one assigned sound, and an event without an assignment remains silent. Presentation interactions trigger audio directly without manufacturing a committed gameplay event. SFX **Optimize** explicitly trims detected silence from existing files one at a time through the same PATH-visible `ffmpeg` pipeline used by conversion; an already clean effect is not re-encoded. Game playback loads and decodes a short effect only when its assigned event occurs; build validates and streams every SFX source unchanged.

There is no free-form recursive JSON-fragment grammar. JSON outside the exact root and item paths is ignored as game source, and a missing/invalid marker, schema, root, path identity, or reference is a diagnostic.

## Compile and pack

Every consumer uses one pipeline:

```text
read marker + schema + exact source paths
→ strict source parsing with provenance
→ deterministic root/item assembly
→ completed GameConfig parse
→ semantic and PNG-resource validation
→ assert no errors
→ bounded square RGBA normalization for `artwork/`; byte-preserving `image/`
→ JSON manifest + JSON GameConfig + ordered raw resource bodies, with Music filtered by the authored playlist and SFX event assignments preserved
→ ARKPACK envelope with optional distribution proof
```

Validation, Editor Build, tests, and packing must not assemble their own variation. Conflicts never silently overwrite another provider; diagnostics retain the owning source path.

Product commands are:

```bash
arkini-cli game schema [--output path]
arkini-cli game validate [project] [--silent]
arkini-cli game pack [project] [--silent]
arkini-cli game replay --incident <latest-directory> --until-fatal [--timeout-ms 10000]
arkini-cli game replay --arkpack <file> --save <file> --until-fatal [--timeout-ms 10000]
arkini-cli diagnostics slice <incident-or-jsonl-path> [--session-id <jsonl-session-id>] [--section all|summary|failure|history|runtime]
```

Replay assumes the supplied Arkpack has already passed the canonical build path, decodes its current artifact and save contracts, and runs the real production `GameSession` without touching installed saves. The incident form resolves the fixed `game.arkpack` and `save.arksave` files. Its bounded text report distinguishes a reproduced fatal failure from a timeout, includes semantic history, and compares the initial and final runtime without dumping duplicate complete states. The common rotating diagnostic directory contains human-readable application runtime and fatal history in `application.md` beside the private gameplay session stream in `diagnostics.jsonl`. Every application record carries severity, the `package.json` application version, packaged/development mode, platform, and architecture; any bounded normalization or final text truncation is visible in the record. Diagnostic slicing defaults to the latest failed gameplay session, accepts the fixed text incident or that rotating JSONL stream, reports malformed input without physical paths, and renders only stable human/LLM-readable text. `--session-id` selects only JSONL sessions; `--section runtime` reads only the fixed incident's complete runtime projection. The fixed incident directory links `incident.md`, `failure.md`, `history.md`, and `runtime-state.md`; Item references include runtime ID, authored ID, and immutable configured UID whenever resolution is possible.

The repository wrappers are `argc game:schema`, `argc build`, and `argc check`. Run schema generation after a source-schema change, validation after content/resource changes, and packing only through the canonical command. Packing validates again, streams `<project>/build/<encoded projectId>.arkpack`, and replaces the prior build; ordinary local and Editor builds are Community. Item Artwork from `artwork/` is compiled to square RGBA no larger than 256 × 256 pixels without enlarging smaller artwork. General PNGs from `image/` retain their exact source bytes and dimensions.

`game validate` and `game pack` accept `--silent` to hide warning diagnostics while preserving errors and normal command results. `argc check --silent` forwards that policy to the bundled game pack; every other repository check remains unchanged.

Repository builds and previews skip packing an unchanged official game through `Argcfile.sh`. `argc arkpack-fingerprint` uses the mise-pinned Coreutils SHA-256 implementation to hash sorted relative paths and raw file bytes: game JSON and PNG sources, project/schema markers, the conservative `src`, `shared`, `electron` and `scripts` source trees, dependency manifests, TypeScript/build configuration and toolchain pins. The generated route tree, Notes and build output are excluded; platform and architecture are included. The project manifest is parsed with the existing Node runtime and hashed with its valid Editor revision normalized to zero; its format version and any other fields remain inputs. Revision-only saves therefore preserve the cache. The conservative source trees still allow harmless rebuilds after unrelated code changes instead of maintaining an import graph. Images are read for hashing but are not decoded or normalized on a cache hit.

The disposable `game/arkini/build/arkini.arkpack.cache` contains the source fingerprint and complete Arkpack checksum. Reuse requires both to match and no active Editor write lock. Provenance verification still runs; missing or damaged records/artifacts rebuild. Repository and prerelease GHA checks cache that build directory under the same fingerprint, then run their normal gates. Release signing always rebuilds; release packaging retains the existing verified prebuilt-artifact flow. Direct CLI packing and Build inside the Editor retain their existing behavior.

[`Argcfile.sh`](Argcfile.sh) `version` updates `package.json`, `package-lock.json`, and the official `project.json.arkini` writer stamp as one repository operation.

## Identity and references

All exact IDs use [`src/game-value/schema/IdSchema.ts`](src/game-value/schema/IdSchema.ts); prefixes are human naming conventions, not new value schemas. References are explicit and are never derived from filenames or title conventions.

There is one Item schema, without an item-type discriminator. Authoring uses `create_item` and `edit_item`; item files live directly in `items/`.

Item `uid` is immutable filesystem identity generated at creation and survives authored-ID renames, import/export and Arkpack rebuilds. Item `id` is the readable gameplay identity referenced by config. Validation rejects duplicate IDs/UIDs and disagreement between item UID and its path.

The package ID has one owner: `game.json` `meta.id`. Catalogs, paths, manifests, and artifacts derive or verify it rather than copying a competing identity.

Renaming `meta.id` creates a different game namespace: existing installed saves remain associated with the old package ID. The Editor preserves output version settings, current source and Notes.

## Authoring semantics

Exact Item capabilities, line/input/rule/output shapes, conditions, rolls, and fields come from `schema.json`. Important cross-field rules are:

The canonical immutable Item vocabulary lives in [`src/item-definition`](src/item-definition): Item schema identities, storage permission, bounded quantities, selectors, and total selection policy over explicit definitions. Authored query scope/reach schemas and canonical Runtime Item query execution live together in `src/item-query`; canonical aggregate reads remain in `src/game-runtime`, while drop/write plus ordinary click reads live in `src/item-interaction`. `SpaceActionSchema` remains with the Space action that interprets it, while `item-action` owns the discriminated action contract, game metadata remains in `src/game-config`, and toolbar size is owned beside location contracts in `src/item-location`.

- every item requires finite `artwork.scale` from `0.25` through `1`; new Editor drafts explicitly start at `1`. This ratio scales the complete artwork canvas, including both default layers, inside an unchanged full tile. `1` fills the tile canvas; transparent PNG padding still affects visible subject size. The Artwork form previews the authored ratio against a tile frame. Board, Editor Board, Inventory and Toolbar share it; occupancy, storage, hit geometry, interaction reach, image resolution and transient container motion do not change;
- storage scope (`board | inventory | toolbar | any`) is different from query reach (`board | inventory | toolbar | any | universe`); `universe` is never storage;
- Board-relative rule conditions require a physical Board origin and evaluate false from Inventory or Toolbar, including zero-count conditions. They remain valid authored conditions on movable items; Clock timers and expiry outputs use the same rule interpretation;
- every start-Board coordinate and current Board selection has explicit `space`; no default or cross-space inference exists;
- runtime purity and stack eligibility are derived state, never an authored flag;
- item `draft` is optional in source, defaults to `false` when omitted, and is only an Editor authoring status with no gameplay or Build filtering semantics;
- An item has `lines` defaulting to an empty array and `maxQueueSize` defaulting to one. Items without lines expose no runtime production controls; adding lines enables the ordinary production contract. An item with `clock` may also have no lines;
- An item may author one optional `action`, a strict discriminated union containing `space` with its target `space` and `inventory` without a target. Both share optional `input` and `rules` collections defaulting to empty. Action rules alone determine click availability; no `enable` field exists. `inventory` opens global Inventory when activated and acts as a directional Inventory drop target that stores the exact source stack through ordinary scope and capacity while keeping the target in place. An occupied `space` action target is similarly a directional portal drop target: it moves the exact source stack to the first free compatible cell on the authored Board before input, merge, stack or swap resolution, without activating the action or changing the current space;
- canonical Item validation rejects simultaneous `action` and nonempty `lines`. Editor capability switches clear the opposing capability in one form update with advance help; JSON and MCP reject conflicting data without silently deleting authored fields;
- line input is passive; Enqueue and Tick own execution;
- material selectors may name any canonical item, including Clock identities whose interval and lifetime continue advancing in input and job storage while their Clock rules permit time;
- positive extra material capacity is supported for item lines;
- `units` defines a finite supply inside each item instance (health, resource stock, or uses), separately from stack `quantity`: passive and manually operated resources use ordinary items; scheduled production adds Item.clock;
- `self` unit costs use the line owner, while `target` is valid only for a units input and its deterministic Board payer (including an owner with units selected at self distance);
- outputs author ordinary `drop` or `random` Board strategy; there is no hidden replacement-output mode. Every weighted candidate owns explicit `rules`: candidate rules filter the pool before weights are summed, while rules on the candidate's individual drops remain post-selection gates and never cause a replacement draw;
- directional merge rules belong to the source item and never imply a reverse rule;
- optional item `clock` groups optional `intervalMs`, optional `durationMs`, optional `expiryMode`, `enable`, `rules`, and `onExpire`. At least one timer is required. It allows every storage scope but requires `maxStackSize: 1` and no Action; lines may be empty. Both timers advance for the exact runtime identity in every location scope while Clock rules permit time; moving between Board and passive storage neither pauses nor resets them. A periodic pulse outside Board advances phase but cannot admit Board-owned production, and returning to Board creates no catch-up work. Its authored `enable` defaults to true; missing duration means unlimited active lifetime. Missing interval gives a one-shot lifetime without pulses. The Editor exposes both timers as optional fields and offers expiry output only with a lifetime;
- `clock.expiryMode` is `loose-kill` (also the meaning of omission) or `kill-switch`, and matters only with a finite lifetime. Loose-kill waits for accepted production to settle, including output placement. Kill-switch cancels queued and active work and removes the owner atomically: reserved items are placed first, then unused input materials, then the normally resolved Clock expiry output. Placement follows ordinary storage, stack and global limits; anything that cannot fit is lost and recorded in gameplay events. Consumed active-job inputs remain consumed, spent units are not refunded, and canceled jobs emit no line output. Incoming deliveries return through their ordinary return path. Jobs already completed at the same Tick boundary retain their completion precedence.
- Item `control` is optional and defaults to interactive behavior; `automatic-only` restricts player production independently of the Clock capability;
- line `default` and optional `clock` independently select the manual and automatic line. At most one authored line per role is allowed; Editor controls clear the same flag on siblings. Clock without a selected line still ages normally and creates no work;
- a capability, field, or schema variant is not runtime-backed until an owned command/Tick path and focused behavior proof implement it.

Do not repeat field catalogs in prose or weaken a schema to silence malformed data. Change the owning schema/behavior together and regenerate the project schema.

Item artwork currently uses its authored default composition and scale throughout runtime. Progress-based artwork selection is deferred to [issue #725](https://github.com/marek-hanzal/arkini/issues/725).

## Validation

Validation extends beyond Zod shape parsing. It owns source/path identity, duplicate providers and records, reference integrity, semantic relationships/cycles, unit payer and affordability constraints, scope/capability compatibility, resource existence/usage, completed config, and other runtime preconditions. Diagnostics preserve source and entity provenance. Finite items without a configured recreation path, or with only stochastic recreation, receive non-blocking unit-renewal warnings for every item.

The compiler must reject an invalid project without producing a usable artifact.

## Editor sidecars

Notes are stored once in `notes/<noteId>.json` with Markdown content, ordering/freshness timestamps, and optional unique `itemUids` and `resourceIds` arrays. Missing link arrays normalize to `[]`; a note is globally unlinked only when both arrays are empty. Item links use immutable UIDs, while Resource links use the current canonical resource IDs. The global Notes route and every Item or Artwork detail Notes tab share one composer/list; authoring forms do not expose Notes. Create/edit validates both relationship sets against the open project and guards updates by `expectedUpdatedAtMs`. Item deletion strips absent UIDs, and resource rename/delete rewrites affected resource IDs in the same ordered best-effort file plan while preserving the note and advancing its freshness.

Notes are portable but do not change authoring revision and do not enter Build or Arkpack output. The live Editor Board is ephemeral: named scenarios and internal project history are not supported. Use Git to version the portable project.

The project stores `game.json.version` as `{ major, minor, suffix? }`, the last manually chosen Arkpack output version. Major and minor are nonnegative safe integers; the optional suffix starts with an ASCII letter or digit and then permits ASCII letters, digits, dots and hyphens. Fresh projects start at `{ major: 1, minor: 0 }`. Build saves valid version settings before compilation, retaining them on failure without changing authoring revision or the live Board. Ordinary authoring and package-ID rename preserve these settings. CLI uses the same saved fields; compilation formats them as `major.minor[-suffix]`. Arkpack import parses that external string once. Authors decide compatibility; no content diff or automatic bump exists.

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
