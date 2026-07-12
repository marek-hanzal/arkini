# V1 completed-game compiler and validation boundary

Implemented after the deep review handoff of snapshot `279b3494`.

## Canonical production flow

Every authoring entry point now shares one completed-game pipeline:

```text
source directory
→ collect deterministic source paths
→ parse each JSON file as GameSourceSchema
→ assemble fragments with source provenance
→ reject duplicate providers and canonical keys
→ parse the assembled candidate as GameConfigSchema
→ run semantic validators and collect diagnostics
→ fail pack/validate on error diagnostics
→ allow warning diagnostics
```

The same implementation is used by:

- `game:validate` through the Effect CLI `ValidateCommand`;
- `game:pack` before encoding any payload;
- test helpers that load the real `game/arkini` authoring tree.

CLI adapters only render diagnostics and invoke production Effects. They do not own validation rules.

## Domain ownership

```text
source
  owns source discovery, fragment parsing, source-file contracts, and provenance

validation
  owns typed diagnostics and completed-config semantic rules

compiler
  owns source assembly, completed GameConfigSchema parsing, and validator orchestration

pack
  owns binary resources, encoding, compression, and output files
```

The compiler must not import the pack domain. Pack depends on the compiler, never the reverse.

## Source assembly policy

- `meta`, `start`, and `version` are singleton providers; a second provider is an error.
- Item and category keys may be provided exactly once; later definitions never overwrite earlier ones.
- Missing required completed roots remain missing and fail `GameConfigSchema`; the assembler does not synthesize empty collections.
- Explicit empty `items` or `categories` providers are valid.
- Repeated `$schema` references are valid when their paths resolve to the same target file.
- Conflicting resolved `$schema` targets are errors.
- The completed config keeps the least deeply relative equivalent `$schema` path.

## Diagnostic contract

Diagnostics are a schema-backed discriminated union, not an `unknown` evidence bag.

Every diagnostic has:

- stable `code`;
- fixed `severity` (`error` or `warning`);
- authoring `path`;
- optional source file path;
- human-readable message;
- diagnostic-specific typed evidence.

Validators return all known diagnostics in one pass. Warning-only results remain valid; any error blocks both validation and packing.

## Initial semantic rules

The completed-game validator currently owns:

- record key versus embedded immutable ID for items and categories;
- explicit item/category references across start state, selectors, merges, lines, rules, and outputs;
- material-input acceptance self-loops and longer cycles, including tag-expanded edges;
- maximum one simultaneously emitted `replace` drop per selected output result;
- finite deposit sustainability warning.

Input acceptance cycles are an offline authoring invariant. Runtime input commands must not grow a general graph traversal or DAG framework.

`replace` means one transformation of the origin. Replace chains are intentionally unsupported unless a future gameplay requirement explicitly changes this policy.

## Pack boundary

`PayloadSchema.config` is `GameConfigSchema`, not `unknown`. A successfully decoded pack therefore guarantees the same completed structural contract as the compiler.

## Placement guards added with this pass

- Partial placement remains a normal `PlacementUnavailableError`.
- Exact requested quantity succeeds.
- Over-placement is an internal `PlacementPlanInvalidError`.
- Replace quantity larger than one stack is covered at the prefix/remainder seam: the first stack occupies the origin and the remainder follows normal scope placement.

The existing placement orchestration split remains unchanged.

## Explicit non-goals

- no runtime input-cycle validation;
- no generic graph framework;
- no generic runtime CRUD repository;
- no replace-chain runtime;
- no second compiler or validator implementation for tests;
- no validation logic embedded in CLI commands;
- no de-Effectification or inlining of small pattern-defining Fx functions;
- no general soft-lock solver yet.

## Future validator passes

Add new rules to the same diagnostics boundary as concrete gameplay contracts arrive:

- tag selector with no possible matches, once warning/error policy is decided;
- blueprint and recipe self-dependencies;
- progression reachability and sustainable source graphs;
- `maxCount` soft-lock combinations;
- job, effect, grant, and unlock graph constraints;
- broader start-state progression checks.

Do not create one-off validator CLIs or parallel compile paths for these rules.
