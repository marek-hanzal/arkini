# Add tests and debug tools

Status: IN_PROGRESS

## Goal

Add enough safety checks and runtime traces to stop future refactors from silently corrupting saves, config references, cache patches, or command behavior.

## Current state

- `npm run check` is the full local gate: format check, dependency-cruiser, typecheck, Vitest, build.
- `npm run dc` enforces the first boundary rules with dependency-cruiser.
- Vitest is installed and has focused tests for board/inventory visual event cache patching.
- Dev builds expose `window.__ARKINI_DEBUG_TIMELINE__` with selected TileEngine pointer/drag/drop events and action-cache visual event application.
- Zod schemas validate many view/config shapes.

## Remaining proposed work

- Add focused tests for domain action results:
  - activation with insufficient placement
  - craft claim with no output space
  - requirement present but non-consumed
  - input consumed only after successful output plan
- Add manifest validation tests:
  - item IDs
  - asset IDs
  - loot table IDs
  - activation inputs/requirements
  - craft recipes
  - upgrade costs/effects
- Expand debug timeline only when a bug report needs more data. Prefer structured JSON events over a visual overlay until geometry itself becomes impossible to report.

## Acceptance

- `npm run check` stays green.
- New action/cache/manifest behavior has focused tests when practical.
- Debug timeline can provide enough ordered information for drag/drop/animation bug reports without polluting production behavior.

## Watchouts

- Do not add a heavyweight test stack casually.
- Keep validation close to data/domain, not UI.
- Do not turn debug tooling into a second runtime. It should observe, not steer.
