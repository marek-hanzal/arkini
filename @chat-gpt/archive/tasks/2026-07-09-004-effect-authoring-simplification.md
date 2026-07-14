# Effect authoring simplification

Status: pending after runtime shape is stable.

## Goal

Reduce repeated JSON ceremony in `game/arkini`, especially repeated `nearby.require`, repeated grant selectors, repeated labels, and verbose item selectors.

## Current pain

Live config has 208 output/drop effects, and 102 of them are `nearby.require`. Many lines repeat the same nearby requirement on both guaranteed and chance outputs. Grant selectors are also verbose for common cases like shrine haste/bountiful and owned-building progression gates.

## Proposed work

1. Add authoring shorthands in the compiler, not runtime state. Runtime should still receive normalized explicit objects.
2. Candidate shorthands:
   - grant selector alias for a single grant id;
   - nearby item selector alias for a single item id/tag;
   - line-level default output requirement applied to every output entry;
   - named reusable local authoring helper for common pollution slowdowns;
   - optional default label generation, so config stops saying `Nearby item:wheat-field` like a debug log escaped captivity.
3. Migrate content gradually, starting with one or two producers, then run validation/tests before broad rewrite.
4. Keep the compiled `GameConfig` explicit. Shorthand belongs only in source JSON and packaging.

## Open decisions for Marek

- Do we want line-level `effects` to apply to all outputs, or only use a new explicit field such as `outputEffects` / `outputDefaults`?
- Should nearby requirements block the whole line or only the concrete output entry? Current system allows per-output gating, but live content often uses it as line-wide gating.
- Should pollution slowdowns be authored as content per producer, or as a named gameplay rule expanded by compiler?

## Acceptance criteria

- Source config gets shorter without hiding gameplay behavior from compiled config.
- Validator errors still point to useful source paths.
- No behavior change from content migration unless explicitly tuned.
