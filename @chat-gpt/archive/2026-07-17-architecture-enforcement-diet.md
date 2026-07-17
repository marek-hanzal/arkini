# Architecture enforcement diet

Review task: #240 under #236.

## Decision

The bespoke `test/architecture` source-text suite was deleted rather than upgraded. It had grown to 12 files / 790 lines and mixed real dependency boundaries with regex naming checks, exact UI copy, exact implementation calls, exact runtime factory lists, and source snippets. Those checks made harmless refactors fail while still missing alternate syntax and method-based escape hatches.

Do not replace it with a custom AST policy engine.

## Enforcement ownership

- Dependency Cruiser owns stable import direction, renderer/Electron separation, archive and test isolation, compiler-to-pack direction, and other graph-level contracts.
- Focused tests own public runtime, GameOwner, security, persistence, appearance, compiler, CLI, packaging, and generated renderer behavior.
- TypeScript, Zod, compiler, and validation tests own type/schema contracts.
- `CODE_GUIDE.md` plus implementation/review own same-name `*Fx`, object + factory composition, one `IdSchema`, semantic-token usage, file/export grammar, and similar maintenance conventions.

Do not add code solely to prove that a coding smell cannot recur. Add automation only for an observable stable contract.

## Concrete cleanup

Deleted all files under `test/architecture`. Added only two stable graph rules to Dependency Cruiser that were previously hidden in source scans:

- engine compiler may not import binary pack implementation;
- active production/tooling code may not import `test/**`.

Existing dependency rules already cover engine/bridge/UI/page/route direction, Electron isolation, archive isolation, React independence, and test-file imports. Existing focused suites cover the behavior previously approximated through source strings.
