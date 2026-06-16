# Refactor backlog

Status: ACTIVE

This backlog captures remaining Arkini v0 work after the core rewrite, TileEngine split, animation pass, and GPT working-environment cleanup.

## Recommended order

1. `012-tile-animation-overhaul.md`
2. `013-dnd-motion-bugfix.md`
3. `014-tile-engine-grid-snap-bugfix.md`
4. `016-drag-snap-before-commit.md`
5. `008-domain-effect-boundary-audit.md`
6. `009-economy-content-pass.md`

Done recently: `004-split-game-item-definitions.md`, `006-tile-engine-public-api-hardening.md`, `007-render-performance-audit.md`, `010-tests-and-debug-tools.md`

## Recently completed environment work

- dependency-cruiser boundary gate added as `npm run dc`.
- unified validation gate added as `npm run check`.
- Vitest introduced with focused visual-event cache patch tests.
- board/inventory TileEngine wiring moved into concrete model hooks.
- dev debug timeline exposed as `window.__ARKINI_DEBUG_TIMELINE__`.
- Dev Sheet scenario loader added for deterministic animation bug reports.

Completed task files are retained with `DONE` status. Old audit files outside this backlog are reference material only. The top-level `@chat-gpt/README.md` is the current working map.
