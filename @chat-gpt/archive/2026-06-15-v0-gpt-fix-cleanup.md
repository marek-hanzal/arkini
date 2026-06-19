# Comment cleanup pass

Status: DONE

## Library-first analysis

Installed libraries already cover the heavy jobs we need to keep: React Query owns durable read/cache state, Motion owns item movement, Effect owns persistence/domain roots, Kysely owns typed table access, and XState remains useful only for real phased workflows such as the generic drag lifecycle and TileEngine motion handoff.

This pass intentionally removes XState from simple UI toggles/timers/queues instead of adding another state library. Sheeting, feedback pulses, visual actor origins, and serialized play work are small enough for focused React hooks/reducers. Drag/drop remains on the existing generic drag workflow and TileEngine Motion pipeline; replacing it wholesale would be a separate DnD overhaul, not a comment cleanup.

## Changes

- Removed fix marker blocks and fixed the underlying issues instead of leaving future archaeology traps.
- Deleted the duplicate database `table` constant and switched Kysely calls to typed table-name literals.
- Split local table row types into standalone table files and kept `Database` as the typed Kysely aggregate.
- Let `dbFx` expose the inferred `dbFxImpl` type instead of lying with a hand-written Effect signature.
- Switched command input validation roots to `parseAsync`.
- Replaced sheet, feedback, visual motion, and play event queue XState machines with small hooks/reducers.
- Split the large play drag hook into focused readers/runners while keeping TileEngine responsible for pointer interaction.
- Split cross-surface drop target registry into focused helpers and fixed falsy payload handling.
- Removed the play root React context and replaced it with a stable DOM id-backed ref.
- Split database/item sheet content into standalone components and aligned bottom nav to three equal columns.
- Batch-completed ready upgrade jobs with one guarded SQLite update.

## Acceptance

- No fix marker comments remain.
- `.git` is preserved.
- The codebase keeps client-only/offline architecture.
- DnD behavior is not rewritten wholesale in this pass; the main cleanup reduces global hook/state noise before the larger DnD overhaul.

## Validation notes

- Fix marker grep is clean.
- Local source import scan resolves all project-local imports.
- `git diff --check` is clean.
- Dependency install did not finish inside this environment, so full project typecheck/build could not be completed here. The available global TypeScript parser check did not surface syntax-class errors, but it cannot prove dependency-backed types without `node_modules`.
