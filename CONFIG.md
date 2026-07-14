# Arkini game configuration

This document is the canonical authoring and compilation guide.

Game content lives under `game/arkini` as JSON fragments plus PNG resources. The directory layout is organizational; compilation is recursive and deterministic.

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
npm run game:schema
npm run game:validate
npm run game:pack
```

Defaults:

```text
authoring directory: game/arkini
JSON Schema output: game/schema.json
binary pack output: game/arkini.game.arkpack
```

Run `game:schema` after changing authoring schemas. Run `game:validate` after changing config or resources. Packing performs validation again and must refuse invalid content.

## 3. Source fragments

Each JSON file may provide any subset of the completed root:

```text
$schema
meta
resources
start
version
categories
items
```

Provider rules:

- `meta`, `resources`, `start`, and `version` each have exactly one provider across all fragments;
- category IDs are unique across all fragments;
- item IDs are unique across all fragments;
- later files never silently overwrite earlier providers;
- conflicts are diagnostics with source provenance;
- the first deterministic provider remains the assembly candidate while every conflict is reported.

Fragments should stay small and domain-oriented. Organize content by era and item role when that improves navigation; directory names do not alter runtime semantics.

## 4. Completed root

The completed game config contains:

```text
meta        Game ID, title, board size, inventory size.
resources   Explicit non-item resource roles used by the shell.
start       Initial board coordinates and inventory quantities.
categories  UI-facing category records keyed by stable ID.
version     Configuration schema version.
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
id
 type
 title
 description
 asset
 tags
 categoryId
 scope
 maxCount?
 maxStackSize
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
memory
cheat-speed
nuke
cheat-inventory
```

Type-specific schemas own their additional behavior. Do not add one giant optional-field item object.

### Scope

An item declares where it may live:

```text
board
inventory
any
```

Runtime locations additionally include line-input and job scopes. Those are live ownership states, not authoring storage choices.

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
deposit    Authored capacity from a matching board deposit.
```

The active runtime resolves `simple` and `materials`. Deposit input authoring and validation exist, but runtime capacity resolution intentionally fails until deposit state is implemented. Do not claim deposit gameplay support merely because the schema parses it.

Material mode:

```text
consume
reserve
```

Reserved inputs are job-owned locks and return only after completion through standard drop placement. Jobs are not cancellable.

Quantity is explicit through value or bounded quantity schemas. `capacity` describes extra material buffering above the required amount; it is not an alternative quantity mode. While a line runs, capacity zero closes that material input and positive capacity keeps it open as storage.

Craft authoring uses `CraftLineSchema`, `CraftInputSchema`, and `CraftInputMaterialSchema`. Its material capacity is fixed to `0` at schema parse time. Authors may omit the field or write `0`; any positive craft capacity is rejected before semantic validation. The completed runtime shape still contains `capacity: 0`, so generic line and input execution retain one uniform contract.

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

Runtime-executed outputs use standard placement. They do not bypass stack, scope, max-count, replacement, or capacity rules. Active jobs reserve worst-case future output against `maxCount` before start: ranges use their maximum, chance rolls reserve success, repeated weighted rolls reserve the repeatable worst candidate, and alternative sets use the per-item maximum. Queue entries reserve nothing until dispatch. Schema-only outputs remain authoring intent until an owned runtime path executes them.

## 8. Item capability status

Schema support and runtime support are different facts.

### Runtime-backed now

- `simple` items participate in stacking, placement, queries, rules, and ordinary runtime commands.
- `producer` items expose one or more lines, queue capacity, explicit start, fixed-step jobs, material consume/reserve inputs, generic line output, and FIFO dispatch.
- `craft`, `blueprint`, and `stash` items expose their configured line through the shared line/start/job machinery.
- Starting a stacked `craft` resolves eligibility from the pre-command world, creates the active job in the candidate draft, atomically isolates one owner quantity, and places the remainder through the standard pure-stack/drop/inventory policy. Completion then consumes that isolated owner, applies any resolved `replace` drop at the original board cell, and places additional `line.output` drops atomically.
- Blueprint completion creates a new `targetId` identity at the exact blueprint cell, places optional top-level blueprint output as by-products, removes state bound to the blueprint identity, and returns reservations atomically.

### Schema-backed but incomplete in runtime

- top-level `stash.output` and stash self-consumption are not yet applied by job completion.
- deposit capacity spending, depletion, and depletion output are not implemented.
- temporary-item lifetime and expiry are not implemented.
- memory, inventory-opener, speed-cheat, nuke, and cheat-inventory item kinds are authoring contracts without active public runtime commands.

Keep authored data valid, but do not build UI or gameplay assumptions on schema-only capabilities. A capability becomes implemented only when it has a canonical runtime command/path and focused behavioral tests.

## 9. Merge authoring

Merge schemas and reference validation are present. Runtime merge execution is not yet part of the active public command surface.

The authored source item describes:

- which target it matches;
- how the source should be handled;
- whether the target should be kept, removed, or replaced.

Treat these fields as validated authoring intent until a canonical merge write command implements them. Do not reconstruct merge behavior in UI, and do not confuse ordinary placement-plan merging with gameplay item merging.

## 10. Validation

Validation covers more than Zod shape parsing. It includes, among other rules:

- duplicate providers and records;
- exact item/category/line references;
- selector and condition references;
- output references;
- replacement constraints;
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

When removing migrated or obsolete content, remove it from active authoring rather than keeping duplicate historical definitions beside the canonical item.
