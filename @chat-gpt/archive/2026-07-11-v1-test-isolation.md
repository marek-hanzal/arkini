# V1 test isolation

Moved all v1 tests and test-only support code out of `src/v1` into the root test tree.

## Layout

Production and test code now mirror by domain without an extra `v1` segment:

```text
src/v1/<domain>/**
test/<domain>/**
```

Test-only fixtures and readers live in domain-local `support` directories rather than production `test` folders.

Examples:

```text
src/v1/output/fx/dropFx.ts
test/output/fx/dropFx.test.ts

test/output/fx/support/dropRuleTestRuntime.ts
test/schema/support/readArkiniGameSources.ts
```

## Import boundary

- Tests import production modules through `~/*`, which resolves to `src/*`.
- Tests import test-only support through `~test/*`, which resolves to `test/*`.
- Production TypeScript configuration does not define `~test`.
- `src/v1` must not import Vitest or test-only support.

## Tooling

- `vitest.config.ts` discovers only `test/**/*.test.ts`.
- `tsconfig.json` typechecks production and CLI code without Vitest configuration.
- `tsconfig.test.json` typechecks the test tree as a separate consumer of production contracts.
- `npm run typecheck` runs both source and test typechecks.

## Guard

`test/architecture/SourceIsolation.test.ts` scans `src/v1` and rejects:

- `*.test.ts`
- `*.spec.ts`
- imports from `~test/*`
- imports from `vitest`

The existing production `testChanceFx` remains in `src/v1/roll/fx`; despite its unfortunate English ambiguity, it is a gameplay chance evaluator rather than test infrastructure.

## Validation completed

- Source typecheck passed.
- Test typecheck passed.
- Full Vitest suite passed: 73 files, 141 tests.
