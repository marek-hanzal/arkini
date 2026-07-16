# Historical implementation oracle

This directory is outside every active source root.

It is intentionally excluded from:

- source and test TypeScript compilation;
- Vitest discovery;
- Vite bundling;
- Dependency Cruiser roots;
- Biome formatting.

Active code and tests may never import from `src/_archive`. Dependency Cruiser enforces that boundary. Files here may contain obsolete imports, types, tests, and architecture because they are retained only as a behavioral and presentation oracle.

This tree is not production code and is not an architectural template.

Use it only to recover deliberately selected:

- player-visible behavior;
- UX and copy;
- edge cases and test scenarios;
- animation/audio intent;
- information the renderer needs from public engine reads.

Do not copy its save model, timestamp scheduler, action bus, runtime adapter/store mirrors, bridge-owned domain logic, config compiler conventions, or directory topology.

## Before reading a directory

1. Read `@chat-gpt/tasks/COVERAGE.md`.
2. Confirm that the current numbered task names the directory.
3. Read the local README when present.
4. Ignore code already marked superseded unless a concrete missing behavior points back to it.

## Cleanup

Historical source is removed after each vertical slice captures its remaining behavior in current code/tests/docs. Git retains archaeology.

Already removed as fully superseded and dependency-independent:

- historical CLI/compiler/audit tooling;
- historical UI layer-system audit.
