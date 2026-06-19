# Refactor backlog

Status: HISTORICAL / EPIC BACKLOG

This backlog captures remaining Arkini v0 work after the core rewrite, TileEngine split, animation pass, and GPT working-environment cleanup.

## Recommended order

This folder is now an epic/backlog archive, not the main task queue. The `000-*` numbering is just one useful way to group larger themes; new v0-specific task notes can live under `@chat-gpt/v0/` without pretending every small follow-up is an epic carved into stone tablets.

Current practical next task lives in `@chat-gpt/v0/README.md`: producer/local placement planner.

Still deferred here:

1. `009-economy-content-pass.md` - blocked/deferred until the economy/content direction is intentionally reopened.
2. `010-tests-and-debug-tools.md` - continue only when new behavior needs focused coverage or debug timeline data.

Done recently: `004-split-game-item-definitions.md`, `006-tile-engine-public-api-hardening.md`, `007-render-performance-audit.md`, `008-domain-effect-boundary-audit.md`, `010-tests-and-debug-tools.md` initial coverage slice.

## Recently completed environment work

- dependency-cruiser boundary gate added as `npm run dc`.
- unified validation gate added as `npm run check`.
- Vitest introduced with focused visual-event cache patch tests.
- board/inventory TileEngine wiring moved into concrete model hooks.
- dev debug timeline exposed as `window.__ARKINI_DEBUG_TIMELINE__`.
- Dev Sheet scenario loader added for deterministic animation bug reports.

Completed task files are retained with `DONE` status. Old audit files outside this backlog are reference material only. The top-level `@chat-gpt/README.md` is the current working map.
