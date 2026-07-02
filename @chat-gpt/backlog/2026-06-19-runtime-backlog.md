# Runtime backlog

Deferred or broader tasks. Promote one into `tasks/` when it becomes current work.

## Architecture / runtime

- Pure vs Effect boundary audit: classify pure helpers vs Effect programs and remove duplicated business decisions. See `2026-06-19-pure-vs-effect-boundary-audit.md`.
- Game engine model topology audit: inspect whether small model contracts under `src/engine/model` should stay engine-level or move beside top-level domains. Do not split dense core schemas for line count.
- Do not create capability matrix enforcement outside `GameConfigSchema`; legality belongs to config validation, not a separate runtime whitelist. Reopen only for a concrete bug or an intentional schema rule.
- Runtime adapter audit: check whether `RuntimeGameEngineAdapter` is a justified orchestration boundary or carrying too many concerns. Keep dormant until a concrete adapter pain appears.
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
