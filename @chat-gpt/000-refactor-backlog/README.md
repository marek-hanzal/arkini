# Refactor backlog

Status: ACTIVE

This backlog captures remaining Arkini v0 work after the core rewrite, TileEngine split, animation pass, and GPT working-environment cleanup.

## Recommended order

No new broad refactor is selected right now. The repo is intentionally checkpointed for an incoming large product change, so avoid opening `009-economy-content-pass.md` or additional architecture work until that change lands. Future cleanup should be picked from the actual conflict/feature shape after the new ZIP is available, not from stale optimism, the most renewable resource in software.

Current deferred candidates:

1. `009-economy-content-pass.md` - blocked/deferred until the incoming product change lands.
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
