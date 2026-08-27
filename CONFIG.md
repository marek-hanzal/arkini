# Arkini game configuration

This document is the canonical authoring and compilation guide.

Game content lives under `game/arkini` as JSON fragments plus PNG resources. The ordinary authoring layout is organizational, recursive, and deterministic. Portable Editor projects use the strict layout described in section 12 so editor metadata is never compiled as game content.

## 1. Canonical flow

```text
collect JSON source files
→ parse source fragments
→ deterministic assembly with provenance
→ completed GameConfig schema parse
→ semantic validation
→ PNG resource validation
→ assert no errors
→ encode MessagePack
→ gzip compressed Arkini pack
```

The same compiler is used by tests, validation, and packing. Do not create an alternate assembly path for convenience.

## 2. Commands

```bash
arkini-cli game schema
arkini-cli game validate
arkini-cli game pack
```

Defaults:

```text
authoring directory: game/arkini
JSON Schema output: game/arkini/schema.json
project build output: game/arkini/build/arkini.arkpack
```

Run `game schema` after changing authoring schemas. Run `game validate` after changing config or resources. Packing performs validation again and must refuse invalid content.

The repository `version` command updates `package.json`, `package-lock.json`, and the official project's exact `project.json.arkini` writer identity together before any release build.

## 3. Source fragments

Each JSON file may provide any subset of the completed root:

```text
$schema
meta
resources
start
version
items
```

Provider rules:

- `meta`, `resources`, `start`, and `version` each have exactly one provider across all fragments;
- item IDs are unique across all fragments;
- item UIDs are unique across the completed catalog;
- later files never silently overwrite earlier providers;
- conflicts are diagnostics with source provenance;
- the first deterministic provider remains the assembly candidate while every conflict is reported.

Fragments should stay small and domain-oriented. Organize content by era and item role when that improves navigation; directory names do not alter runtime semantics.

## 4. Completed root

The completed game config contains:

```text
meta        Game ID, title, Board size, Inventory size, optional Toolbar size.
resources   Explicit non-item resource roles used by the shell.
start       Initial Board coordinates, Inventory quantities, Toolbar slots, and current Board space.
version     Project-owned gameplay and save compatibility version in `<major>.<minor>` form.
items       Canonical item records keyed by stable ID.
$schema     Optional authoring-tool reference.
```

The record key and the embedded entity ID must describe the same canonical entity. Exact reference validity is enforced by compiler diagnostics.

## 5. IDs

All exact IDs use the single shared `IdSchema`.

Do not invent domain ID schemas. Prefixes such as `item:`, `producer:`, or `line:` are naming conventions for humans, not separate TypeScript/Zod value types.

References are explicit. Do not derive target IDs, asset IDs, or line IDs from filenames or naming conventions unless the schema explicitly defines such derivation.

## 6. Items

Every item shares these core fields:

```text
uid
id
type
title
description
asset
scope
maxCount?
maxStackSize
charges?
merge?
```

Schema-recognized item kinds include:

```text
simple
producer
blueprint
craft
stash
deposit
temporary
inventory
```

Type-specific schemas own their additional behavior. Do not add one giant optional-field item object.

`uid` is the immutable low-level identity generated once as CUID2 when an item is created. It survives authoring-ID renames, editor import/export, and Arkpack rebuilds unchanged. `id` remains the human-readable authoring identity used by configuration references. Completed-game validation rejects duplicate item UIDs.

### Storage and query scope

An item storage scope declares where the item may physically live:

```text
board
inventory
toolbar
any
```

The singleton Inventory opener is the deliberate exception: its authored Board scope controls automatic placement, while its exact live location may be Board or Toolbar but never Inventory.

Query reach is a separate contract:

```text
board     → origin-space Board, with distance
inventory → shared Inventory
toolbar   → shared Toolbar
any       → origin-space Board plus Inventory and Toolbar
universe  → every Board space plus Inventory and Toolbar
```

`universe` is never an item storage scope. Runtime locations additionally include line-input, reserved-material, and consumed-job scopes; those are live ownership states, not authoring storage choices.

### Board spaces

Every authored start-board item has a mandatory non-negative `space` beside its coordinates. There is no default or compatibility fallback. `start.currentSpace` is also mandatory and becomes persistent root navigation state.

Board occupancy and every spatial rule use `space + x + y`. Placement, distance, charges, merge, and outputs remain inside the origin space; `any` scope fallback may continue through the global Inventory and then Toolbar but never another Board space. Those passive surfaces are the only cross-space bridges. An explicit passive-storage interaction may target an off-screen Board identity, but direct Board-to-Board transport and production across spaces remain forbidden.

Attached ownership state has no historical or independent space. Moving an owner through Inventory or Toolbar carries its buffered inputs, active job, consumed roots, reservations, and queue. Local `board` or `any` dependencies are re-evaluated against the destination space; `universe` dependencies remain visible. Completion and release always derive their origin from the owner's current Board location.

### Stacking

`maxStackSize` is the configured stack limit. Stack compatibility also requires runtime purity: the concrete item must own no buffered line input, active job, queued request, or other identity-bound state. Purity is runtime state, not an authored item flag.

### Assets

Assets are explicit IDs resolved against PNG resources.

Blueprint assets are an explicit tuple:

```text
[blueprintAssetId, completedTargetAssetId]
```

Multiple blueprints may intentionally share one blueprint visual. Do not manufacture item-specific asset IDs when explicit reuse is intended.

## 7. Product lines

A line contains:

```text
id
 title
 description
 show
 enable
 runtimeMs
 input[]
 output?
 rules[]
```

`runtimeMs: 0` completes immediately.

Filling inputs does not start work. Starting is an explicit runtime command.

### Inputs

Schema-recognized input kinds:

```text
simple     A condition-like requirement with no material operation.
materials  Delivered items that are consumed or reserved.
deposit    One deterministic external charged-item target selected from the board.
```

Every input may optionally author a charge cost:

```json
{
  "charges": {
    "cost": 1,
    "from": "self" | "target"
  }
}
```

`from: "self"` charges the line owner. `from: "target"` is valid only on a deposit input and charges the board item resolved by its query. `deposit` is the interaction kind for one external board payer, not a required item type. Validation therefore requires the selected item to have sufficient charges and a scope of `board` or `any`. Validation also sums unavoidable costs within one line and rejects totals above `charges.amount × finite maxCount`. A deposit input must author a target charge cost and never moves the target into an input buffer.

Material mode:

```text
consume
reserve
```

Both modes commit the accepted quantity to the active job. Reserved inputs move the same live runtime instance into `reserved` scope, retain identity and state, remember no historical location, and return through canonical existing-item placement. Pure reserved items may normalize into ordinary stacks; impure reserved items preserve identity and require an exclusive cell. Consumed inputs are destructive conversion: their passive owned state is discarded when the job actually starts, only the root remains inaccessible in `job` scope, and completion discards it permanently. Merely storing material in the input does not destroy anything. Jobs are not cancellable.

A material selector references one exact canonical item. That item must be capable of entering material-input storage; temporary items are board-bound and therefore invalid material inputs.

Quantity is explicit through value or bounded quantity schemas. `capacity` describes extra material buffering above the required amount; it is not an alternative quantity mode. While a line runs, capacity zero closes that material input and positive capacity keeps it open as storage.

Every line owner uses the same `LineSchema` and `InputMaterialSchema`. Positive material `capacity` is syntactically valid, but game validation allows it only on producer-owned lines; craft, blueprint, and stash lines must author zero capacity. This semantic rule keeps one schema grammar while still rejecting unsupported buffering with an exact authoring path.

### Rules

Implemented line rule kinds:

```text
show
hide
enable
disable
runtime-multiplier
```

Rules are authored in order. Evaluation produces ordered rule results; each consumer interprets the result for its own projection.

Conditions use explicit query-based `when` variants such as existence, count, and range checks.

### Outputs

An output contains one or more alternative roll sets. One set is selected by relative weight, then every roll inside that set is evaluated.

Implemented rolls include:

```text
guaranteed
chance
weight
```

Each resolved drop authors board placement as `drop` or `random`. `drop` uses the supplied source position as its spatial origin. `random` selects one position from the complete board, including occupied cells, then delegates the whole resolved quantity to the same stack-first, nearest-first placement used by `drop`. An occupied random origin is never rerolled; standard placement resolves outward from it. Inventory fallback is determined independently by the emitted item's scope. There is no output replacement operation; item lifetime and output placement are separate contracts.

Runtime-executed outputs use standard placement and never bypass stack, scope, max-count, purity, or capacity rules. Active jobs reserve worst-case future output against `maxCount` before start: ranges use their maximum, chance rolls reserve success, repeated weighted rolls reserve the repeatable worst candidate, and alternative sets use the per-item maximum. Consumed job materials and depleted owners offset output of the same canonical item because they disappear at completion. Runtime hydration validates the same live-plus-reserved capacity. Queue entries reserve nothing until dispatch.

## 8. Item capability status

Schema support and runtime support are different facts.

### Runtime-backed now

- `simple` items participate in stacking, placement, queries, rules, and ordinary runtime commands.
- `producer` items expose one or more lines and queue capacity; `craft`, `blueprint`, and `stash` expose one line. All use the same line/input/output runtime.
- `line.output` is optional for every line and is the only job output location. Every resolved drop keeps its authored `drop` or `random` placement.
- Any item may author finite lifetime as `charges: { amount, output? }`. An item without charges persists; an item dies when one instance reaches zero charges.
- Any input may author a charge cost. `from: "self"` charges its line owner; `from: "target"` is restricted to deposit inputs and charges one deterministic matching board target.
- A fresh charged item omits `remainingCharges` and remains pure at its authored full amount. Partial spend stores the remaining value and isolates one stateful board instance. Full idle depletion consumes one quantity without relocating the rest of its stack.
- An idle depleted target dies and emits optional `charges.output` immediately during start. A depleted active owner remains only until its current job completes, then dies before `line.output`; depletion output follows line output.
- Starting any stacked line owner resolves eligibility from the pre-command world, attaches job/input/charge state in one candidate, atomically isolates surviving stateful quantities, and standard-places pure remainders.
- Blueprint assets are explicit standard item assets; no target or visual is inferred from output.
- Directional gameplay merge is an engine-owned atomic command over one revised source identity and one revised board target. Source-owned authored rules decide source action, target effect, and optional output.
- Temporary items author `durationMs` and optional expiry `output`. Every committed runtime identity starts at the authored duration, remains board-only and non-stackable, persists `remainingDurationMs`, and expires through canonical Tick plus deterministic output placement.
- Cheat mode is persisted gameplay state rather than an item kind. `runtime.cheats.instantGameplay` makes valid time-based work settle without waiting while cheat behavior is enabled; `setInstantGameplayFx()` owns the atomic switch.

### Utility capability

- `inventory` is the singleton Board/Toolbar opener. Its canonical primary action opens the shared non-modal Inventory surface, and its actor uses the same cross-surface drop contract as every other live tile.

A capability becomes implemented only when it has a canonical command/path and focused behavioral tests. Schema presence alone is not behavior.

## 9. Merge authoring and execution

The authored source item owns an ordered list of directional merge rules. The first rule whose exact item selector matches the concrete board target wins; reverse matching is never inferred. Semantic validation requires every target item to be board-capable, every replacement result to allow board presence, and a self-target merge to permit at least two live identities when `maxCount` is finite.

Each rule describes:

- `action: "consume" | "use"` for exactly one source quantity;
- `effect: "keep" | "remove" | "replace"` for exactly one board target;
- `result` only for replacement;
- optional output resolved through the standard output and placement grammar.

The canonical runtime command accepts revised source and target identities. A source may be on the board or in inventory; the target must be on the board. `consume` permanently converts one idle source quantity. `use` requires a pure idle source and returns that quantity through standard drop placement around the target after the target effect. `remove` uses standard owner removal, while `replace` preserves target identity and position but requires one pure idle target quantity.

Source action, target effect, source return, optional output, runtime validation, and the `item:merged` event are one atomic committed transition. Failed placement or validation leaks no partial mutation or event. Merge randomness derives from stable source/target facts and the authored rule, so blocked retries do not reroll.

UI passes only the selected source and target identities. It never chooses the rule or rebuilds merge logic. Ordinary same-item stack placement remains a separate capability despite humanity assigning both operations the same word.

## 10. Validation

Validation covers more than Zod shape parsing. It includes, among other rules:

- duplicate providers and records;
- exact item and line references;
- selector and condition references;
- output references;
- input charge payer and affordability constraints;
- resource existence;
- runtime-relevant semantic cycles or impossible relationships;
- completed-config validity.

Diagnostics retain source paths and entity provenance so authoring failures point back to the fragment that owns them.

Do not silence validation by weakening a schema to accept malformed authoring. Fix the owning contract or the data.

## 11. Authoring workflow

For a content change:

```text
edit the smallest owning fragment
→ regenerate schema when contracts changed
→ validate game directory
→ run focused tests if behavior changed
→ run full repository check
→ pack only after validation is clean
```

Removed content has no place in active authoring; keep only the canonical item definition.

## 12. Portable Editor projects

An Editor project is a directly versionable filesystem directory with this logical shape:

```text
project.json
schema.json
game.json
items/<type>/<uid>.json
assets/*.png
resources/*.png
notes/*.json
scenarios/*.json
versions/head.json
versions/<versionId>/{version.json,manifest.json}
objects/<sha256>.{json,png}
```

`project.json` is mandatory and contains only `arkini`, the Arkini version that last saved the project, and the last published `revision`. The engine owns this portable game-project format; the Editor and CLI both consume it. `schema.json` is generated from Arkini's current project source schema directly into the project root. `game.json` owns the non-item completed root, the package ID in `meta.id`, and its gameplay `version`, and references `./schema.json`; every item file owns one direct `item`, is placed by canonical item type and immutable UID, and references `../../schema.json`. The marker, schema, and references must match the exact current contract. `resources/` contains shell resources; `assets/` contains item artwork. Compilation reads only `game.json`, `items/<type>/*.json`, `assets/*.png`, and `resources/*.png`; notes, scenarios, versions, objects, locks, and temporary files are never game sources.

Notes are portable but deliberately excluded from authored-game revisioning, Build, Arkpack output, and version manifests. The live Editor Board is not persisted. Explicitly named Board scenarios are portable JSON envelopes and are included in version snapshots.

Versions are full logical snapshots, not property-level diffs. A manifest maps the complete game, item, asset, resource, and scenario set to immutable content-addressed objects. Objects, the manifest, and the descriptor are written before `versions/head.json` publishes the version; orphaned objects and incomplete version directories are ignored.

Electron main owns the separate `<userData>/arkini/editor/projects.json` root catalog. Its entries contain no project ID: each root is validated and derives the canonical identity from `game.json` `meta.id`. New projects and Arkpack imports create managed project directories below user data. Opening an Editor folder validates the complete project and works directly in that external directory. JSON export copies the current portable folder, while game validation, Build, and Arkpack generation keep using the canonical compiler and packer.

Editor writes use the shared Node-only `FilesystemWrite` mechanics under one ignored, optimistic `editor.lock`. The same canonical lock serializes service instances and processes, refreshes its lease while owned, and can replace a stale lock after a crashed writer. Each mutation stages, syncs, and recoverably replaces only its exact Arkini-owned write/delete set while preserving unrelated root contents; interrupted work is completed or rolled back before the next read or write. Version checkout includes the current tree, scenarios, and `versions/head.json` in one such set. Managed create/delete reconciliation completes at startup. There are no migrations, compatibility readers, or automatic filesystem watchers. Explicit Refresh from disk remains the hard reset that discards local drafts and reloads the complete directory.
