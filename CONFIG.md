# Arkini game authoring

This document owns the portable project layout, compiler flow, and author-facing semantic boundaries. [`src/game-config-source`](src/game-config-source) owns exact source files, source schemas, and the generated `schema.json`; [`src/game-config`](src/game-config) owns completed config values; [`src/game-config-validation`](src/game-config-validation) owns semantic validation; [`src/game-config-compiler`](src/game-config-compiler) owns canonical compilation; [`GAME.MD`](GAME.MD) owns runtime interpretation.

## Canonical project

A project is one directly versionable directory:

```text
project.json
schema.json
game.json
items/<type>/<uid>.json
assets/<id>.png
resources/<id>.png
notes/<noteId>.json
scenarios/<hash>.json
versions/head.json
versions/<versionId>/{version.json,manifest.json}
objects/<sha256>.{json,png}
```

Only `game.json`, `items/<type>/<uid>.json`, `assets/*.png`, and `resources/*.png` are game sources. Project metadata, notes, scenarios, version history, objects, locks, temporary files, and ignored `build/` artifacts are never compiled. Editor Build and `arkini-cli game pack` nevertheless require this working source tree to match its published Version HEAD exactly; validation may still inspect an uncommitted working tree.

- `project.json` is the root marker and contains Arkini writer provenance plus current project revision.
- `schema.json` is generated from the current source schema and must expose stable root/definition identity.
- `game.json` is the strict complete non-item root and owns `$schema`, package metadata/ID, gameplay version, resources, and start state.
- Each item file is a strict `{ $schema, item }` document. Its path owns canonical type and immutable encoded UID; its item owns the human-authored ID.
- `resources/` contains package-shell resources and `assets/` item artwork. The current source contract accepts PNG bytes; schema support does not imply another runtime resource type.

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
→ MessagePack encode
→ gzip Arkpack
```

Validation, Editor Build, tests, and packing must not assemble their own variation. Conflicts never silently overwrite another provider; diagnostics retain the owning source path.

Product commands are:

```bash
arkini-cli game schema [--output path]
arkini-cli game validate [project]
arkini-cli game pack [project]
arkini-cli game replay --incident <latest-directory> --until-fatal [--timeout-ms 10000]
arkini-cli game replay --arkpack <file> --save <file> --until-fatal [--timeout-ms 10000]
arkini-cli diagnostics slice <incident-or-jsonl-path> [--session-id <jsonl-session-id>] [--section all|summary|failure|history|runtime]
```

Replay assumes the supplied Arkpack has already passed the canonical build path, decodes its current artifact and save contracts, and runs the real production `GameSession` without touching installed saves. The incident form resolves the fixed `game.arkpack` and `save.arksave` files. Its bounded text report distinguishes a reproduced fatal failure from a timeout, includes semantic history, and compares the initial and final runtime without dumping duplicate complete states. The common rotating diagnostic directory contains human-readable application runtime and fatal history in `application.md` beside the private gameplay session stream in `diagnostics.jsonl`. Every application record carries severity, the `package.json` application version, packaged/development mode, platform, and architecture; any bounded normalization or final text truncation is visible in the record. Diagnostic slicing defaults to the latest failed gameplay session, accepts the fixed text incident or that rotating JSONL stream, reports malformed input without physical paths, and renders only stable human/LLM-readable text. `--session-id` selects only JSONL sessions; `--section runtime` reads only the fixed incident's complete runtime projection. The fixed incident directory links `incident.md`, `failure.md`, `history.md`, and `runtime-state.md`; Item references include runtime ID, authored ID, and immutable configured UID whenever resolution is possible.

The repository wrappers are `argc game:schema`, `argc build`, and `argc check`. Run schema generation after a source-schema change, validation after content/resource changes, and packing only through the canonical command. Packing validates again and atomically replaces `<project>/build/<encoded projectId>.arkpack`; ordinary local and Editor builds are Community.

[`Argcfile.sh`](Argcfile.sh) `version` updates `package.json`, `package-lock.json`, and the official `project.json.arkini` writer stamp as one repository operation.

## Identity and references

All exact IDs use the shared `IdSchema`; prefixes are human naming conventions, not new value schemas. References are explicit and are never derived from filenames or title conventions.

Item `uid` is immutable filesystem identity generated at creation and survives authored-ID renames, import/export, Versions, and Arkpack rebuilds. Item `id` is the readable gameplay identity referenced by config. Validation rejects duplicate IDs/UIDs and disagreement between item type/UID and its path.

The package ID has one owner: `game.json` `meta.id`. Catalogs, paths, manifests, and artifacts derive or verify it rather than copying a competing identity.

## Authoring semantics

Exact item variants, line/input/rule/output shapes, conditions, rolls, and fields come from `schema.json`. Important cross-field rules are:

The canonical immutable Item vocabulary lives in [`src/item-definition`](src/item-definition): Item schema identities, storage permission, bounded quantities, selectors, and total selection policy over explicit definitions. Authored query scope/reach schemas and canonical Runtime Item query execution live together in `src/item-query`; canonical aggregate reads remain in `src/game-runtime`, while drop/write plus ordinary click reads live in `src/item-interaction`. `SpaceSchema` remains with the Space action that interprets it, game metadata remains in `src/game-config`, and toolbar size is owned beside location contracts in `src/item-location`.

- storage scope (`board | inventory | toolbar | any`) is different from query reach (`board | inventory | toolbar | any | universe`); `universe` is never storage;
- every start-Board coordinate and current Board selection has explicit `space`; no default or cross-space inference exists;
- runtime purity and stack eligibility are derived state, never an authored flag;
- line input is passive; Enqueue and Tick own execution;
- material selectors name items capable of input storage; temporary Board identities are invalid material;
- positive extra material capacity is supported only for producer-owned lines;
- `self` charge costs use the line owner, while `target` is valid only for a deposit input and its deterministic Board payer;
- outputs author ordinary `drop` or `random` Board strategy; there is no hidden replacement-output mode;
- directional merge rules belong to the source item and never imply a reverse rule;
- an item type, field, or schema variant is not runtime-backed until an owned command/Tick path and focused behavior proof implement it.

Do not repeat field catalogs in prose or weaken a schema to silence malformed data. Change the owning schema/behavior together and regenerate the project schema.

## Validation

Validation extends beyond Zod shape parsing. It owns source/path identity, duplicate providers and records, reference integrity, semantic relationships/cycles, charge payer and affordability constraints, scope/capability compatibility, resource existence/usage, completed config, and other runtime preconditions. Diagnostics preserve source and entity provenance.

The compiler must reject an invalid project without producing a usable artifact.

## Editor sidecars

Notes are portable but do not change authoring revision and do not enter Versions, Build, or Arkpack output. Scenarios are explicit portable gameplay-State snapshots included in Versions; the live Editor Board is not persisted. Versions are complete immutable logical snapshots published through `versions/head.json`, not property deltas.

Ordinary Project, Item, and resource saves never change the Arkpack gameplay version. The first explicit Version commit records the complete starting snapshot at its existing version (`1.0` for a fresh project); Arkpack import creates this root commit automatically while preserving the imported version. Each later commit compares the working tree with the current parent snapshot and applies exactly one strongest compatibility result: any major-classified gameplay field produces one major bump, otherwise any minor-classified field or resource change produces one minor bump, and scenario-only changes produce no bump. A major commit deletes every current Board scenario after presenting that consequence in the commit preview. Branch identity is the Version ID, so sibling commits may legitimately carry the same gameplay version and no-op parent/child commits may share one version.

Editor operations use the same directory, schemas, validation, compiler, and packer as the CLI. JSON import opens or creates this exact format; export creates a new unique child, copies only portable allowlisted paths, validates it, and never overwrites an existing destination. External project roots preserve `.git` and unrelated files.

`src/asset-authoring` owns the Assets product catalog, browser-file admission, import/edit/delete sessions, and presentation. `src/authoring-session` owns the mounted-project object-URL lifecycle shared by authoring products, while `src/authoring-form` owns the canonical Asset-reference form control. `src/game-config-resource` is the flat upstream authored-config contract for embedded PNG and source-descriptor schemas, bounded PNG byte/decode admission, references, source discovery, usage, and rename semantics; Asset Authoring consumes that contract instead of creating a second Resource domain. Explicit non-item resource roles belong to the completed `src/game-config` value they populate.

## Content workflow

```text
edit the smallest owning root/item/resource
→ regenerate schema if contracts changed
→ validate
→ run focused behavioral tests when semantics changed
→ run the closing repository gate required by risk
```
