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
artwork/<uid>.png
artwork/<uid>.json
image/<uid>.png
image/<uid>.json
music/<uid>.ogg
music/<uid>.json
sfx/<uid>.ogg
sfx/<uid>.json
notes/<noteId>.json
```

Only `game.json`, `items/<uid>.json`, `artwork/*.png`, `image/*.png`, `music/*.ogg`, and `sfx/*.ogg` are game sources. Every binary resource has a paired `<uid>.json` file containing validated Editor metadata, not gameplay config or packed resources. Project metadata, resource titles, Notes, locks, temporary files, and ignored `build/` artifacts never enter Serapacks. Editor Build and `serakki-cli game pack` validate and build the current saved sources directly.

Portable projects support ordinary files and directories only. Symlinks anywhere in a project, including a linked project root, are unsupported.

An open Editor project has one writer. Changing its files outside the Editor while it remains open is unsupported; close it before editing files externally and reopen it afterward. Refresh does not provide external-write synchronization or conflict recovery.

- `project.json` is the root marker and contains Serakki writer provenance plus current project revision.
- `schema.json` is generated from the current source schema and must expose stable root/definition identity.
- `game.json` is the strict complete non-item root and owns `$schema`, package metadata/ID, structured output version, resources, and start state.
- Each item file is a strict `{ $schema, item }` document. Its path owns canonical type and immutable encoded UID; its item owns the same immutable UID and a human-readable title.
- `artwork/` contains square Item Artwork. `image/` contains unrestricted-aspect launcher and shell images such as Hero and About avatars. Both accept PNG and share one global resource-UID namespace; the typed root owns semantic type and the filename owns immutable UID. Artwork **Optimize** is an explicit source edit that losslessly re-encodes selected Artwork at its original dimensions; imports never rewrite source bodies automatically. Build bounds only Artwork to square RGBA no larger than 512 × 512; Image bytes and dimensions are preserved.
- `music/` contains the Editor's canonical Ogg/Opus track library. Music shares the global resource-UID namespace; the filename holds its assigned immutable UID. `game.json.music.playlist` explicitly selects the unique tracks used by the global random playlist; tracks selected by the playlist or requested by `items/<uid>.json.item.music` enter the Serapack. An item music request stores an exact Music resource UID and does not add that track to the global playlist. Unreferenced tracks remain project sources. The Editor keeps valid Ogg/Opus bytes unchanged, or converts another selected audio format one file at a time through `ffmpeg` when that command exists in `PATH`; conversion trims detected silence from the beginning and end while preserving internal pauses. Music preview is requested lazily from the native file and supports byte ranges; no audio body crosses renderer IPC. Build validates and streams each selected track unchanged into Serapack.
- `sfx/` contains canonical Ogg/Opus sound effects. SFX share the global resource-UID namespace; filenames hold assigned immutable UIDs. `game.json.sfx.events` maps exact SFX event IDs to resources; the vocabulary includes committed gameplay events, including accepted queue intents, Autofill delivery admission, explicit queue clearing, and an item disappearing without an actually placed lifecycle replacement, plus explicit presentation interactions such as Item Detail opening and closing. Each event has at most one assigned sound, and an event without an assignment remains silent. Presentation interactions trigger audio directly without manufacturing a committed gameplay event. SFX **Optimize** explicitly trims detected silence from existing files one at a time through the same PATH-visible `ffmpeg` pipeline used by conversion; an already clean effect is not re-encoded. Game playback loads and decodes a short effect only when its assigned event occurs; build validates and streams every SFX source unchanged.

- Every Artwork, Image, Music and SFX body has an adjacent strict `{ "title": "Display title" }` JSON file. The title is non-empty, editable, and need not be unique. Import assigns a fresh UID and initializes a readable title from the source filename. Importing the same file again creates a separate resource; there is no content deduplication. Renaming edits metadata only. Replacing content and Optimize preserve UID, references and title. Libraries and selectors display/search titles while references retain UIDs. Missing bodies, missing metadata, or invalid pairs are errors; there is no legacy reader or automatic migration.
- Portable project export retains both files and their UIDs. Serapacks contain neither metadata files nor display titles; importing a Serapack creates Editor metadata with UID-derived initial titles. Selected-Music packaging, all-SFX packaging, and lazy native streaming remain unchanged. Artwork and audio deletion surfaces show usage and remove the pair through existing project write serialization and reference cleanup. The general Image library currently exposes import and title editing.

There is no free-form recursive JSON-fragment grammar. JSON outside the exact root and item paths is excluded from gameplay assembly; resource sidecars have their own strict metadata validation, and a missing/invalid marker, schema, root, path identity, or reference is a diagnostic.

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
serakki-cli editor import artwork <projectId> --file <path> [--file <path> ...]
serakki-cli editor import music <projectId> --file <path> [--file <path> ...]
serakki-cli editor import sfx <projectId> --file <path> [--file <path> ...]
```

Editor imports require the saved project ID (see `serakki-cli project list`) and an explicit `--file` for every source path. Each import creates a fresh resource UID, converts the original filename into a readable title, and writes the binary plus its paired `{ "title": ... }` sidecar through the Editor repository. Artwork must be a square PNG; Music and SFX use the Editor's Ogg/Opus preparation, including FFmpeg conversion when needed. The command prints the title and UID of each imported resource.

Replay assumes the supplied Serapack has already passed the canonical build path, decodes its current artifact and save contracts, and runs the real production `GameSession` without touching installed saves. The incident form resolves the fixed `game.serapack` and `save.serasave` files. Its bounded text report distinguishes a reproduced fatal failure from a timeout, includes semantic history, and compares the initial and final runtime without dumping duplicate complete states. The common rotating diagnostic directory contains human-readable application runtime and fatal history in `application.md` beside the private gameplay session stream in `diagnostics.jsonl`. Every application record carries severity, the `package.json` application version, packaged/development mode, platform, and architecture; any bounded normalization or final text truncation is visible in the record. Diagnostic slicing defaults to the latest failed gameplay session, accepts the fixed text incident or that rotating JSONL stream, reports malformed input without physical paths, and renders only stable human/LLM-readable text. `--session-id` selects only JSONL sessions; `--section runtime` reads only the fixed incident's complete runtime projection. The fixed incident directory links `incident.md`, `failure.md`, `history.md`, and `runtime-state.md`; Item references include runtime ID and immutable definition UID whenever resolution is possible.

The repository wrappers are `argc game:schema`, `argc build`, and `argc check`. Run schema generation after a source-schema change, validation after content/resource changes, and packing only through the canonical command. Packing validates again, streams `<project>/build/<encoded projectId>.serapack`, and replaces the prior build; ordinary local and Editor builds are Community. Item Artwork from `artwork/` is compiled to square RGBA no larger than 512 × 512 pixels without enlarging smaller artwork. General PNGs from `image/` retain their exact source bytes and dimensions.

`game validate` and `game pack` accept `--silent` to hide warning diagnostics while preserving errors and normal command results. `argc check --silent` forwards that policy to the bundled game pack; every other repository check remains unchanged.

Repository builds and previews skip packing an unchanged official game through `Argcfile.sh`. `argc serapack-fingerprint` uses the mise-pinned Coreutils SHA-256 implementation to hash sorted relative paths and raw file bytes: game JSON and PNG sources, project/schema markers, the conservative `src`, `shared`, `electron` and `scripts` source trees, dependency manifests, TypeScript/build configuration and toolchain pins. The generated route tree, Notes and build output are excluded; platform and architecture are included. The project manifest revision is part of the Serapack manifest, so its bytes are included in the fingerprint and a revision change rebuilds the package. The conservative source trees still allow harmless rebuilds after unrelated code changes instead of maintaining an import graph. Images are read for hashing but are not decoded or normalized on a cache hit.

The disposable `game/serakki/build/serakki.serapack.cache` contains the source fingerprint and complete Serapack checksum. Reuse requires both to match and no active Editor write lock. Provenance verification still runs; missing or damaged records/artifacts rebuild. Repository and prerelease GHA checks cache that build directory under the same fingerprint, then run their normal gates. Release signing always rebuilds; release packaging retains the existing verified prebuilt-artifact flow. Direct CLI packing and Build inside the Editor retain their existing behavior.

[`Argcfile.sh`](Argcfile.sh) `version` updates `package.json`, `package-lock.json`, and the official `project.json.serakki` writer stamp as one repository operation.

## Identity and references

All exact IDs use [`src/game-value/schema/IdSchema.ts`](src/game-value/schema/IdSchema.ts); prefixes are human naming conventions, not new value schemas. References are explicit and are never derived from filenames or title conventions.

There is one Item schema, without an item-type discriminator. Authoring uses `create_item`, `edit_item`, and the exact-line `create_item_line`, `replace_item_line`, and `delete_item_line`; item files live directly in `items/`. Line writes require the project revision from a preceding read, preserve unrelated item values, and use the same repository revision checks. Every line has one immutable `uid`, unique across all lines in the project. The Editor generates it when creating or copying a line and exposes no editable identity field; titles remain freely editable. MCP line creation accepts a complete UID-free line config and assigns a fresh UID; replacement addresses `lineUid` and preserves it. Delete and reorder also address `lineUid`/`lineUids`, preserving remaining identities and order. `item_line_order` accepts a revision-pinned exact permutation of all current line UIDs. Unknown UIDs, repeated requested UIDs and incomplete orders are rejected before writing. Compiler and Editor repository admission reject duplicate line UIDs across items as well as within one item. Graph operation identity, Editor deep links, runtime jobs, buffers, deliveries and selected lines all use this UID. No user-authored line ID or compatibility reader remains.

`edit_item_lines` batches 1–20 create/replace/delete operations across items using one snapshot and expected project revision. Each existing item/line UID pair may appear once; each create operation receives its own new UID. It shares exact-line mutation rules with the single-line tools, validates completed items before one best-effort repository commit, and publishes one revision and notification. Invalid operations or stale revision reject the whole batch before writing; persistence retains the existing best-effort file-plan contract.

MCP `item_detail` includes the project revision for lightweight authoring reads. `item_lines` returns formatted text with ordered authored line titles, exact identities and behavior flags, while `item_lines_json` returns canonical configs for up to 50 unique item/line pairs from one snapshot. Batch line reads preserve first-request order, deduplicate pairs, and explicitly report missing items and missing line UIDs.

Item/config writes validate Template outcome and Inventory destination references on changed items under the repository write guard. Removing a template cannot strand an existing item outcome or receiver transport reference, including through a complete config replacement. Compiler diagnostics, deletion blockers, form feedback and write admission share the same exact item template-reference traversal; unrelated pre-existing broken references do not block an unrelated edit.

Item `uid` is the sole immutable definition identity, generated at creation and preserved through import/export and Serapack rebuilds. Config maps are keyed by UID; canonical references use `itemUid`. The Editor does not expose identity editing. Validation rejects duplicate source providers and disagreement between a definition UID, config key, or file path. Runtime `itemId` identifies a live instance, distinct from its definition UID.

MCP `rename_item` selects an exact `itemUid` and changes only `title`. Resource identities are immutable and independent; resource authoring changes titles or replaces content without changing references. Writes retain the revision-guarded project lock and ordered best-effort file plan, without per-file atomic replacement or aggregate rollback. An interrupted write can leave an incomplete file.

The package ID has one owner: `game.json` `meta.id`. Catalogs, paths, manifests, and artifacts derive or verify it rather than copying a competing identity.

Renaming `meta.id` creates a different game namespace: existing installed saves remain associated with the old package ID. The Editor preserves output version settings, current source and Notes.

## Authoring semantics

Exact Item capabilities, line/input/rule/outcome shapes, conditions, rolls, and fields come from `schema.json`. Important cross-field rules are:

The canonical immutable Item vocabulary lives in [`src/item-definition`](src/item-definition): Item schema identities, bounded quantities, selectors, and total selection policy over explicit definitions. Authored query distance schemas and canonical Runtime Item query execution live together in `src/item-query`; canonical aggregate reads remain in `src/game-runtime`, while drop/write plus ordinary click reads live in `src/item-interaction`. `outcome` owns the strict discriminated `OutcomeSchema` union and its Item/Space/Template schemas; game metadata remains in `src/game-config`.

- every item requires finite `artwork.scale` from `0.25` through `1`; new Editor drafts explicitly start at `1`. This ratio scales the complete artwork canvas, including both default layers, inside an unchanged full tile. `1` fills the tile canvas; transparent PNG padding still affects visible subject size. The Artwork form previews the authored ratio against a tile frame. Game and Editor Board share it; occupancy, hit geometry, interaction reach, image resolution and transient container motion do not change;
- Board query distance uses Chebyshev reach within the origin Space: `self` is 0, `close` is exactly 1, `near-close` is 1 or 2, `near` is exactly 2, and `far` is any positive distance. Diagonals count; these Board-relative distances except `self` exclude the origin;
- items have no storage scope: all physical grid placement is on a Board. Queries contain a selector and one required `distance`: `self`, `close`, `near-close`, `near`, or `far`. All ranges use the physical origin Board; `far` includes every other cell in that space. Material Autofill additionally restricts sources to the producer’s own space, regardless of query distance or the currently viewed space;
- Board-relative rule conditions require a physical Board origin. Clock interval admission and terminal line outcomes use the same rule interpretation;
- optional `templates` in `game.json` stores reusable boards with immutable `uid`, author-facing `title`, own `width` and `height`, and `board` placements (`itemUid`, `x`, `y`) without `space`. Template UIDs and occupied cells are unique; placements must fit their template dimensions and reference existing items. Project board dimensions seed new templates only; changing them never resizes existing templates. Template detail can duplicate a board under a fresh UID with its contents intact, then opens the new template for editing. Templates ship in Serapack config. `start.spaces` assigns `{ space, templateUid }` pairs with unique spaces; each assignment applies its template independently through the shared board replacement operation. Runtime and saves persist the active template UID per space; startup assignments only seed a new game. The selected `start.currentSpace` must have a template assignment before Build succeeds; incomplete projects remain authorable. Other unmapped spaces start empty with `meta.board` fallback dimensions. The loaded Serapack remains the authority for all board dimensions, including after loading a save; saves never duplicate dimensions. The Graph Engine preserves initial space assignments and every template placement as separate authored relationships. item deletion is blocked by them unless forced, which removes those placements.
- every initial template assignment and current Board selection has explicit `space`; no default or cross-space inference exists;
- item definitions have no global instance-count cap; use query conditions such as `exists` or `count` in production rules to control availability;
- each assigned template cell creates one item in its exact Board cell; runtime items represent single identities, while authored input and Item outcome quantities count separate items;
- An item has `lines` defaulting to an empty array and `maxQueueSize` defaulting to one. Items without lines cannot run production; adding lines enables the ordinary production contract. An item with `clock` may also have no lines;
- line input is passive; Enqueue and Tick own execution;
- New Editor production lines start with no inputs and require an explicit choice before saving. The collection plus menu offers Simple, Materials Consume/Reserve, or Units Target/Self before editing that variant’s fields. Self is unavailable while the owner has no Units; choosing it binds the query to that owner at self distance. Opening or dismissing the menu does not create a draft; selecting a variant appends and selects it. The last input may be removed while editing, leaving the line incomplete until another is selected.
- Editor collection plus menus likewise choose the rule, condition, roll, or outcome type before appending a new entry. Item outcomes offer Local and Random drop placement as separate creation choices; Space outcomes offer exact, Previous Space, and Inventory. Available rule types follow the owning context; the selected type determines its initial fields and is not switched within the entry detail.
- material inputs require `query` (selector plus one explicit Autofill distance); there is no implicit reach or legacy top-level selector. Autofill owns material delivery;
- material selectors may name any canonical item, including Clock identities whose interval and lifetime continue advancing in input and job storage while their Clock rules permit time;
- each material input stores at most its authored `quantity.max`; there is no extra input capacity;
- `units` defines a finite supply inside each item instance (health, resource stock, or uses), independently of authored input and Item outcome counts: passive and manually operated resources use ordinary items; scheduled production adds Item.clock;
- `self` unit costs use the line owner, while `target` is valid only for a units input and its deterministic Board payer (including an owner with units selected at self distance). Unit payers always belong to the owner’s space, ordered by Manhattan distance, row, column and runtime ID;
- line and merge `outcome` use one `OutcomeTableSchema`: alternative sets with rules and weights, each containing Guaranteed or Chance rolls. Each roll owns ordered outcome entries discriminated by `type`: `item` contains `itemUid`, `quantity`, `placement` and `rules`; `space` contains `space` and `rules`; `template` contains `templateUid` and `rules`, referencing an existing board template. Template resets the outcome origin space through the shared atomic replacement operation. Item placement uses ordinary `drop` or `random` Board strategy. Set rules filter before weighted selection; individual outcome rules gate after selection and never cause a replacement draw. Portals are ordinary default zero-duration lines with Space outcomes; there is no Item Action capability;
- Item `keywords` is optional free text for search aliases. Editor identity edit/detail surfaces keep it beside Description. Item catalog, reference pickers and MCP item collection share search ranking by distinct fields: title strongest, then ID, then description, then keywords, with related-item terms last. Exact title and ID matches precede fuzzy matches; exact description and keyword matches do not. Keywords are saved with the item and retained in compiled game data. Blank form text removes the optional field.
- Space outcome and receiver transport destinations use `space: <nonnegative integer> | "previous" | { type: "inventory", templateUid: <UID> }`, owned by `src/space/schema/SpaceDestinationSchema.ts`. Previous Space means the last space left by committed player navigation, resolved at settlement. Without history the outcome is skipped and receiver transport is rejected atomically. Inventory is the shorter author-facing name for an item-owned Space; it references an existing template and opens the Space bound to the exact live owning item instance (the receiver for transport). One owner has at most one room per referenced template UID. Outcomes and receiver transport selecting the same template share that room regardless of order; selecting different templates creates different rooms. Repeated weighted outcomes may intentionally select the same room. Destroying the owner recursively destroys all its rooms and contents and releases their addresses; a replacement retaining the runtime identity retains the bindings. Creation, binding, transport and teardown settle atomically with the owning operation. The Editor outcome menu distinguishes destination variants at creation; the receiver transport destination control retains its detail tooltip. Authored graphs preserve dynamic destinations and template identity without inventing runtime addresses.
- explicit directional merge rules belong to the source item and never imply a reverse rule. A receiving item may additionally author one merge with `action: "space"` and a destination `space` instead of `target`; it accepts any dragged item only when no explicit source merge matches. It retains ordinary target effects and optional outcomes, preserves the dragged identity and state, and is independent of production lines. Receiver transport outcomes use the receiver as definition owner; selected failures never fall through to another interaction;
- optional item `clock` groups optional `intervalMs`, optional `durationMs`, `enable`, and `rules`. At least one timer is required. Both timers advance for the exact runtime identity while Clock rules permit time, including inside input, job, or delivery storage. A periodic pulse outside Board cannot admit production or create catch-up work. Authored `enable` defaults to true; missing duration means unlimited lifetime. Missing interval gives a one-shot lifetime. Clock authors `clock-interval` lines in its Editor section;
- optional item `terminationMode` is `loose-kill` (also the meaning of omission) or `kill-switch`. It governs the common terminal boundary reached by Clock lifetime expiry or Units depletion; no other item removal runs a termination line. Loose-kill waits for accepted work and then runs a selected termination Job; blocked placement retains that Job for retry. Kill-switch cancels earlier queued and active work, then runs the selected termination Job. Its completed output and owner removal settle together, discarding output or returned material that cannot fit. Internally held items cannot start a Board Job and settle the selected line outcome immediately from their physical origin, skipping inputs and runtime. Without an eligible line the item disappears without line output;
- Item `ui` is `simple` or `default` (default `simple`). Simple shows item facts and the effective Default manual line’s inputs and direct Job action when present. Default shows visible manual Lines followed by item information in one scrollable detail. Both interfaces allow Board clicks to enqueue the effective Default line, including queue fill. Without a Default line, no click production is available. Engine admission is independent of UI mode; Clock, termination, movement and merge policies are likewise independent;
- every line has one `trigger`: `manual`, `clock-interval`, or `item-termination`. Manual lines alone can be Default. Generic line `weight` is an integer from 1 to 999, default 1; interval and termination selection use it after rule filtering. Interval pulses enqueue only when inputs are available in the line or on the Board. Missing inputs or rejected admission consume that pulse. At finite lifetime expiry or Units depletion, one eligible termination line is drawn by weight; a Board owner enqueues it and runs its authored production time before output settlement;
- a capability, field, or schema variant is not runtime-backed until an owned command/Tick path and focused behavior proof implement it.

Do not repeat field catalogs in prose or weaken a schema to silence malformed data. Change the owning schema/behavior together and regenerate the project schema.

Production lines may optionally reference one Artwork resource through `line.artwork`. The Editor provides an optional Artwork selector; Game Lines and the Editor production detail show the selected image beside the line title. An omitted reference renders no image or placeholder. The reference participates in typed resource validation, usage/deletion checks and resource deletion; it has no effect on production behavior. Existing item files need no update.

Item artwork currently uses its authored default composition and scale throughout runtime. Progress-based artwork selection is deferred to [issue #725](https://github.com/marek-hanzal/serakki/issues/725).

## Validation

Validation extends beyond Zod shape parsing. It owns source/path identity, duplicate providers and records, reference integrity, semantic relationships/cycles, unit payer and affordability constraints, capability compatibility, resource existence/usage, completed config, and other runtime preconditions. Diagnostics preserve source and entity provenance. Finite items without a configured recreation path, or with only stochastic recreation, receive non-blocking unit-renewal warnings for every item.

The compiler must reject an invalid project without producing a usable artifact.

## Editor sidecars

Notes are stored once in `notes/<noteId>.json` with Markdown content, ordering/freshness timestamps, and optional unique `itemUids` and `resourceUids` arrays. Missing link arrays normalize to `[]`; a note is globally unlinked only when both arrays are empty. Item links use immutable UIDs, while Resource links use immutable resource UIDs. The global Notes route and every Item or Artwork detail Notes tab share one composer/list; authoring forms do not expose Notes. Create/edit validates both relationship sets against the open project and guards updates by `expectedUpdatedAtMs`. Item deletion strips absent UIDs, and resource deletion removes affected resource UIDs in the same ordered best-effort file plan while preserving the note and advancing its freshness.

Notes are portable but do not change authoring revision and do not enter Build or Serapack output. The live Editor Board is ephemeral: named scenarios and internal project history are not supported. Use Git to version the portable project.

The project stores `game.json.version` as `{ major, minor, suffix? }`, the last manually chosen Serapack output version. Major and minor are nonnegative safe integers; the optional suffix starts with an ASCII letter or digit and then permits ASCII letters, digits, dots and hyphens. Fresh projects start at `{ major: 1, minor: 0 }`. Build saves valid version settings before compilation, retaining them on failure without changing authoring revision or the live Board. Ordinary authoring and package-ID rename preserve these settings. CLI uses the same saved fields; compilation formats them as `major.minor[-suffix]`. Serapack import parses that external string once. Authors decide compatibility; no content diff or automatic bump exists.

Editor operations use the same directory, schemas, validation, compiler, and packer as the CLI. JSON import opens or creates this exact format; export creates a new unique child, copies only portable allowlisted paths, validates it, and never overwrites an existing destination. External project roots preserve `.git` and unrelated files.

`src/artwork-authoring` owns the Artwork catalog, square-PNG admission, import/edit/delete sessions, Optimize, and presentation. Project Images owns general-PNG import and launcher/shell mappings. `src/audio-authoring` owns shared Music/SFX library import, lazy one-track preview and canonical Ogg/Opus preparation; noncanonical input conversion depends only on a PATH-visible `ffmpeg`. `src/music-authoring` owns random-playlist selection over that shared audio surface, while `src/sfx-authoring` owns event assignment over the Sound-effects workspace and `src/sfx-event` owns the assignable vocabulary. `src/resource-authoring` owns shared typed import orchestration; `src/authoring-session` owns mounted-project resource URLs; `src/authoring-form` owns the typed Resource-reference control. `src/game-config-resource` owns the generic Resource schema, semantic type, exact source discovery, PNG and Ogg/Opus admission, references, usage, and shared title metadata. Explicit non-item Image roles, the global Music playlist, and exact SFX event assignments belong to the completed `src/game-config` value they populate.

## Content workflow

```text
edit the smallest owning root/item/resource
→ regenerate schema if contracts changed
→ validate
→ run focused behavioral tests when semantics changed
→ run the closing repository gate required by risk
```

### MCP scope

Music and SFX are intentionally outside MCP authoring scope: the model cannot listen to and judge the audio. Do not add MCP audio catalogs, preview, import, editing, playlist management, or sound-event assignment tools. Audio selection and authoring belong to the Editor and its existing CLI workflows. Missing Music/SFX tools are not a parity defect.

Resource lifecycle operations (including Artwork and general Images), image catalogs, and Build are also deliberately outside MCP automation scope. Keep resource import, replacement, metadata edits, deletion, optimization, and packaging in their existing Editor/CLI surfaces; do not add MCP counterparts. The existing read-only Artwork catalog remains available for assigning item visuals.

Canonical JSON reads retain saved audio references when they are part of the requested entity; general entity round-tripping preserves them. This does not make audio an MCP authoring capability or require dedicated audio projections.

### MCP Board Template authoring

Prefer the focused tools below over resending the project configuration. Templates use immutable UIDs; cells use zero-based coordinates and existing item UIDs from `item_collection`.

| Tool | Contract |
| --- | --- |
| `template_collection` | Paginated, optionally searched text: UID, title, dimensions, placement count and project revision. |
| `template_detail` | Text for one UID: dimensions, occupied/free counts, zero-based ASCII map (X right, Y down), per-placement symbol/item/coordinate legend, revision and deletion blockers. Above 10,000 cells, explicitly omits the map and retains every placement in the legend. |
| `template_json` | Canonical JSON `{ revision, template }`, including the complete `board` array. |
| `create_template` | Generate a UID; optional dimensions default to project fallback dimensions, optional board to empty. |
| `edit_template` | Patch title, dimensions or the complete board; omitted fields stay unchanged. Shrinking rejects stranded cells. |
| `edit_template_cells` | Apply 1–100 ordered `place`, `replace`, `move` or `remove` changes in one commit. |
| `delete_template` | Delete one unreferenced template; start assignments, Template outcomes and Inventory destinations block deletion with exact reference paths. |

All mutations require the latest project `revision`, returned by reads and successful writes. Create, edit and cell edits accept `{ input: "<serialized JSON>" }`; their descriptions link exact `schema_json` IDs. Delete accepts `{ templateUid, revision }` directly. For example, the decoded cell-edit input is:

```json
{
  "revision": 12,
  "templateUid": "grove-template-uid",
  "changes": [
    { "type": "place", "x": 0, "y": 1, "itemUid": "tree-item-uid" },
    { "type": "move", "from": { "x": 2, "y": 0 }, "to": { "x": 3, "y": 0 } }
  ]
}
```

Place requires an empty destination; replace/remove require an occupied cell; move requires an occupied source and an empty destination. Unknown items, out-of-bounds cells or any invalid step reject the whole request before writing. Single-template tools preserve sibling templates and start assignments. They use the existing revision-guarded, best-effort Editor commit; there is no filesystem rollback or cascading reference rewrite.

`set_start_space` and `remove_start_space` edit one revision-guarded initial template assignment. `edit_project` remains available to replace the complete `templates` collection or `start` section. `edit_project_layout` changes only fallback/new-template dimensions, never existing templates.
