# Runtime backlog

Deferred or broader tasks. Promote one into `tasks/` when it becomes current work.

## Architecture / runtime

- Pure vs Effect boundary audit: classify pure helpers vs Effect programs and remove duplicated business decisions. See `2026-06-19-pure-vs-effect-boundary-audit.md`.
- Legacy manifest cleanup: remove old TS manifest/config/validation fossils after import-graph check.
- Capability matrix enforcement after the audit decides allowed item combinations.
- Keep `GameConfigSchema` / `GameSaveSchema` as intentional dense core contracts; do not split them as line-count cleanup.

## UI / debug

- Manual browser UI pass for board/inventory/sheet sizing and hit areas.
- Continue dark/light tile readability polish only with screenshots.
- Keep `data-ui` anchors useful but sparse.

## Tooling / generated files

- Decide whether to exclude generated `game/arkini.assets.json` from Biome size warning.
- Keep `npm run check` plus compiled config validation in handoff checklist.

## Deferred content

- Economy/content tuning is intentionally out of current scope.
- Product line category UI only when authored grouping is actually needed.
