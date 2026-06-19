# Add tests and debug tools

Status: IN_PROGRESS

## Goal

Add enough safety checks and runtime traces to stop future refactors from silently corrupting saves, config references, cache patches, or command behavior.

## Current state

- `npm run check` is the fast local gate: format check, dependency-cruiser, typecheck and Vitest. Run `npm run build` separately before packaging non-doc work.
- `npm run dc` enforces the first boundary rules with dependency-cruiser.
- Vitest is installed and has focused tests for board/inventory visual event cache patching plus visual-event sequencing and animation contract expectations.
- Dev builds expose `window.__ARKINI_DEBUG_TIMELINE__` with selected TileEngine pointer/drag/drop events and action-cache visual event application.
- The Dev Sheet has deterministic scenario buttons for animation bug reports, and dev builds expose `window.__ARKINI_SCENARIO__.list/load`.
- Zod schemas validate many view/config shapes.
- Manifest validation now has focused Vitest coverage for shipped config sanity plus item, asset, loot table, activation input/requirement, craft recipe and upgrade reference failures.
- Domain planning coverage now guards activation placement overflow, virtual inventory planning, activation requirement/input semantics and craft progress completion math.

## Remaining proposed work

- Add focused tests for remaining domain action results once an in-memory/effect DB test harness exists:
  - full activate action transaction failure does not consume stored inputs after output placement failure
  - full craft claim transaction behavior around stored input deletion and board item replacement
- Expand debug timeline only when a bug report needs more data. Prefer structured JSON events over a visual overlay until geometry itself becomes impossible to report.
- Add more scenario fixtures as real animation bugs appear; keep them deterministic and tiny.

## Acceptance

- `npm run check` stays green.
- New action/cache/manifest behavior has focused tests when practical.
- Debug timeline can provide enough ordered information for drag/drop/animation bug reports without polluting production behavior.
- Animated action results carry explicit `animation` metadata for parallel swap, sequenced stash output and instant fade-in spawn behavior.

## Watchouts

- Do not add a heavyweight test stack casually.
- Keep validation close to data/domain, not UI.
- Do not turn debug tooling into a second runtime. It should observe, not steer.
