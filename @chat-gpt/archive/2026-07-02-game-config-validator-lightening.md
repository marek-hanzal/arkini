# Game config validator lightening

## Context

The embedded capability refactor removed most of the old authoring-time reference tables from `game/arkini`: product lines, merge rules, craft recipes, producer/stash capabilities, and grant sources now live where the item capability is defined. That made the old monolithic `GameConfigSchema.ts` increasingly dishonest: the schema file was still acting as a structure parser, reference integrity checker, effect auditor, blueprint graph validator, and gameplay soft-lock analyzer all at once.

The requested follow-up was to check whether the validator is now light enough to focus on real game rules and business invariants instead of babysitting old config structure plumbing.

## Changes

- Reduced `src/v0/game/config/GameConfigSchema.ts` to the Zod data shape plus a single `superRefine(validateGameConfig)` delegate.
- Added `src/v0/game/config/GameConfigTypes.ts` so validation can consume the compiled config type without importing `GameConfigSchema` back and creating a dependency cycle.
- Moved game-config refinement into `src/v0/game/config/validation/GameConfigValidation.ts`.
- Kept the top-level validator ordered by responsibility:
  1. embedded definition/reference integrity,
  2. effect selector consistency,
  3. blueprint dependency cycles,
  4. gameplay soft-lock/reachability risks,
  5. starting state validation.
- Tightened gameplay reachability so hidden or disabled drops are not treated as reachable progression sources unless their show/enable/visibility requirement can itself be reached from the current progression graph.

## Why this matters

The config schema is now mostly structural again. The heavy validator still exists, because business rules and soft-lock prevention are genuinely heavy, but they are no longer buried inside the schema declaration itself. This makes future hardening easier: new game rules can land in validation modules without turning the data schema into another god-file.

The reachability change closes a subtle false-positive hole: before this pass, a producer output that was statically present but permanently hidden or disabled could be counted as a progression source. Runtime would never produce it, but the validator could think the chain was safe. Very cute, in the same way a bridge made of wet cardboard is cute.

## Tests added

- Hidden progression output without a reachable show effect is rejected.
- Hidden progression output with a reachable `grant.drop.show` path is accepted.
- Disabled progression output without a reachable enable effect is rejected.
- Disabled progression output with a reachable `grant.drop.enable` path is accepted.

## Verification

- `npm run format`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- src/v0/game/config/GameConfigSchema.test.ts src/v0/game/compiled/defaultGameConfig.test.ts cli/game/auditGameConfig.test.ts`
- `npm run test`

The existing large-file Biome warning for `game/arkini.assets.json` remains unchanged.
