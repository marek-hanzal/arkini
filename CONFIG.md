# Arkini game authoring

This document owns the portable project layout, compiler flow, and author-facing semantic boundaries. The generated `schema.json` and the schemas under [`src/game-config`](src/game-config) own exact fields; [`GAME.MD`](GAME.MD) owns runtime interpretation.

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

Only `game.json`, `items/<type>/<uid>.json`, `assets/*.png`, and `resources/*.png` are game sources. Project metadata, notes, scenarios, version history, objects, locks, temporary files, and ignored `build/` artifacts are never compiled.

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
```

The repository wrappers are `argc game:schema`, `argc build`, and `argc check`. Run schema generation after a source-schema change, validation after content/resource changes, and packing only through the canonical command. Packing validates again and atomically replaces `<project>/build/<encoded projectId>.arkpack`; ordinary local and Editor builds are Community.

[`Argcfile.sh`](Argcfile.sh) `version` updates `package.json`, `package-lock.json`, and the official `project.json.arkini` writer stamp as one repository operation.

## Identity and references

All exact IDs use the shared `IdSchema`; prefixes are human naming conventions, not new value schemas. References are explicit and are never derived from filenames or title conventions.

Item `uid` is immutable filesystem identity generated at creation and survives authored-ID renames, import/export, Versions, and Arkpack rebuilds. Item `id` is the readable gameplay identity referenced by config. Validation rejects duplicate IDs/UIDs and disagreement between item type/UID and its path.

The package ID has one owner: `game.json` `meta.id`. Catalogs, paths, manifests, and artifacts derive or verify it rather than copying a competing identity.

## Authoring semantics

Exact item variants, line/input/rule/output shapes, conditions, rolls, and fields come from `schema.json`. Important cross-field rules are:

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

Editor operations use the same directory, schemas, validation, compiler, and packer as the CLI. JSON import opens or creates this exact format; export creates a new unique child, copies only portable allowlisted paths, validates it, and never overwrites an existing destination. External project roots preserve `.git` and unrelated files.

`src/asset-authoring` owns the Assets product catalog, renderer PNG/file admission, import/edit/delete sessions, object-URL lifecycle, and presentation. `src/game-config/resource` remains the upstream authored-config contract for resource schemas, references, usage, and rename semantics; Asset Authoring consumes that contract instead of creating a second Resource domain.

## Content workflow

```text
edit the smallest owning root/item/resource
→ regenerate schema if contracts changed
→ validate
→ run focused behavioral tests when semantics changed
→ run the closing repository gate required by risk
```
