# Validation and UI parity pass

Status: final pass after any effect/distance changes.

## Goal

Lock the refactor down so engine, validator, and UI keep saying the same thing. Because if UI lies about effects again, the player will be correct to assume the computer is haunted.

## Coverage targets

- Distance parity: `neighbour`, `near`, `any`, diagonal behavior, deterministic ordering.
- Nearby requirements: line-level and output-owned start/visibility behavior.
- Nearby duration: multiple matching sources, `maxSources`, missing bands, slower/faster labels.
- Capacity spend: nearest source, insufficient remaining capacity, depletion remove/replace.
- Grant effects: passive board/inventory/both, active timed grants, ignored producer job handling.
- Craft support: only supported grant gates/blockers accepted.
- UI bridge: missing effect requirements, bonus lines, output visibility, output-specific bonus labels, duration multiplier labels.

## Tooling targets

Run at least:

```sh
npm run game:validate -- game/arkini
npm run typecheck
npm run test
```

Run full `npm run check` if dependencies are available and the pass touched packaging/schema/format-sensitive files.

## Acceptance criteria

- Current live content compiles/validates.
- Runtime tests prove no unintended behavior change.
- UI line/detail tests prove effect state still displays from runtime truth.
- Any intentional tuning changes are documented in this task or a follow-up archive note.
