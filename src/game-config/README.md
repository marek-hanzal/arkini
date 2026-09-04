# Game Config map

This map separates authored values, portable source, diagnostics, semantic validation, resources and compilation. [`CONFIG.md`](../../CONFIG.md) owns the project format and author-facing semantics; this README answers where to start in code.

## Owners

| Domain | Owns | Public entrypoints |
| --- | --- | --- |
| `game-value` | Foundational immutable identity, required text, quantity and whole-millisecond time schemas | [`../game-value/schema/IdSchema.ts`](../game-value/schema/IdSchema.ts), [`../game-value/schema/TimeSchema.ts`](../game-value/schema/TimeSchema.ts) |
| `game-config` | Completed authored aggregate and loaded-config capability | [`schema/GameConfigSchema.ts`](schema/GameConfigSchema.ts), [`context/GameConfigFx.ts`](context/GameConfigFx.ts) |
| `game-config-source` | Portable filenames, source schemas, discovery, parsing and generated JSON Schema | [`../game-config-source/schema/ProjectSchema.ts`](../game-config-source/schema/ProjectSchema.ts), [`../game-config-source/fx/collectSourceFilesFx.ts`](../game-config-source/fx/collectSourceFilesFx.ts) |
| `game-config-resource` | Embedded PNG/source descriptors, usage, rename, discovery, byte admission and Item-artwork normalization | [`../game-config-resource/schema/ResourceSchema.ts`](../game-config-resource/schema/ResourceSchema.ts), [`../game-config-resource/fx/readPngResourceFx.ts`](../game-config-resource/fx/readPngResourceFx.ts), [`../game-config-resource/fx/resizePngAssetFx.ts`](../game-config-resource/fx/resizePngAssetFx.ts) |
| `game-config-diagnostic` | Provenance-aware diagnostic vocabulary and presentation | [`../game-config-diagnostic/schema/GameDiagnosticsSchema.ts`](../game-config-diagnostic/schema/GameDiagnosticsSchema.ts), [`../game-config-diagnostic/fn/readGameDiagnosticPresentationFn.ts`](../game-config-diagnostic/fn/readGameDiagnosticPresentationFn.ts) |
| `game-config-validation` | Completed-config semantic validation and blocking diagnostics | [`../game-config-validation/fx/validateGameConfigFx.ts`](../game-config-validation/fx/validateGameConfigFx.ts) |
| `game-config-compiler` | Deterministic source assembly, validation orchestration and compilation result | [`../game-config-compiler/fx/compileGameDirectoryFx.ts`](../game-config-compiler/fx/compileGameDirectoryFx.ts) |

Arkpack, Editor Build and CLI consume this pipeline. None of them owns another source reader, config assembler or semantic validator.

## Dependency shape

The foundational schema direction is explicit:

- `game-value` imports only Zod. It owns scalar meaning, not an aggregate, role, lifecycle or behavior.
- Config, Item, Location, Production, queries and other authored contracts may compose those exact scalars directly.
- `game-config → item-definition + game-start + game-value + item-location` because `GameConfigSchema` is the completed authored aggregate and `MetaSchema` composes Board/Toolbar layout schemas.
- `item-definition → production-line + production-output + space-action + game-value` because Item variants embed those authored contracts.
- Production behavior reads Item definitions, so that domain-level pair still crosses schema composition in one direction and behavior in the other.

Do not put an aggregate schema or a domain policy into `game-value` to flatten another graph edge. A reusable scalar belongs there only when its validation meaning is identical across owners.

Behavior starts outside the core schemas:

- Validation executes exact Item, location, production and start policies.
- Compiler executes source/resource reads and validation.
- Runtime and authoring consumers parse or provide completed Game Config values.

Always name the layer in architecture prose. “Validation calls input eligibility” is useful; “Game Config depends on Production” is too coarse.

## Canonical flow

```text
project.json + schema.json + game.json + items + PNG resources
→ source discovery and strict parsing with provenance
→ deterministic root/item assembly
→ GameConfigSchema parse
→ semantic and PNG validation
→ blocking-diagnostic gate
→ completed Game Config
→ Arkpack-only Item-artwork normalization and encoding, or Editor preview
```

Source, validation, Editor Build, CLI and packing must not create variants of this flow. Conflicts remain diagnostics with exact source provenance and never silently overwrite another provider.

## Important invariants

- `game-config` owns values only; it imports no source, validation, compiler, Editor, renderer, route or Electron behavior.
- `game-value` owns only reusable scalar schemas and imports no Arkini domain.
- Source reads exact allowlisted paths. Arbitrary recursive JSON is not game source.
- Source resource descriptors retain whether a PNG came from `assets/` or `resources/`; Arkpack compilation normalizes only `assets/` and preserves `resources/` bytes.
- The generated `schema.json` comes from the current project source-schema union and uses stable references.
- Validation extends beyond Zod shape parsing and preserves source/entity provenance.
- The compiler rejects blocking diagnostics and cannot publish a usable invalid result.
- Gameplay meaning belongs to [`GAME.MD`](../../GAME.MD), not to source or validation convenience.

## Changing this island?

Likely affected:

- Generated project JSON Schema and source admission.
- Semantic validation and diagnostic variants.
- CLI validation/packing, Editor Build and Arkpack admission.
- Project Authoring forms and every current-format authored-data writer.
- Runtime, Flow and Estimate when the completed Game Config shape or semantics change.

Changing a `game-value` scalar has a wider blast radius than changing the completed aggregate. Follow every direct schema consumer, generated JSON Schema, persisted reader and external writer; the defaults below do not apply.

Usually not affected:

- Game Session disposal, Tick timing or installed-package lease ownership for a source-only change.
- Electron Editor transaction mechanics when the portable path set is unchanged.
- Pixi lifecycle and interaction when completed runtime facts are unchanged.

A portable filename, persisted schema, compatibility or provenance change crosses into [`VERSION.md`](../../VERSION.md) and the Editor persistence map at [`../../electron/main/editor-project/README.md`](../../electron/main/editor-project/README.md).
