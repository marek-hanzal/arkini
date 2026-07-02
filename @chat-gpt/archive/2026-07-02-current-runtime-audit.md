# Current runtime audit

Context: final safety pass after root-domain cleanup and senior quality passes. User asked to ensure the active codebase is legacy-free and only the current runtime/config model remains.

Changes:

- Added `npm run audit:current` via `cli/repo/auditCurrent.ts`.
- Wired `audit:current` into `npm run check` so the current-model guard runs with the normal gate.
- The audit rejects removed runtime directories/import namespaces, catch-all `src/**/index.ts(x)` barrels, removed embedded-config fields, removed root config registries, and historical persistence/cache markers in active source/docs.
- It validates both compiled `defaultGameConfig` and freshly compiled `game/arkini` authoring sources for forbidden embedded-model fields.
- Removed a dead dependency-cruiser rule for a removed drop wrapper and removed the stale `@tanstack/react-query` package marker from the UI boundary rule.
- Renamed compiler helpers from product-oriented wording to line/output-oriented wording where the logic already operates on embedded lines.
- Cleaned active README/GAME/index/@chat-gpt notes so current docs describe the active model instead of historical removals.
- Archived completed task notes out of `@chat-gpt/tasks`; active task queue is back to `README.md` only.

Validation run:

- `npm run check`
- `npm run build`
- `npm run audit:optional`

Known unchanged warnings:

- Biome skips `game/arkini.assets.json` because it exceeds the configured file-size limit.
- `game:validate` still reports unused packaged PNG resources.
- Vite still reports the existing >500 kB chunk warning.
