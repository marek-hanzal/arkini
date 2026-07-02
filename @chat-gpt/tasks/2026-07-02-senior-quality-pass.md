# 2026-07-02 Senior quality pass

Context: follow-up after removing `src/v0` and moving runtime into root domains. Goal was to hunt low-quality leftovers, dead APIs, duplicated schema/runtime logic, and validator holes after the layout refactor.

Done:
- Removed dead public exports and one unused sheet alias file.
- Made `knip` clean for active `src`/CLI code.
- Made `jscpd` clean by extracting shared effect schema members, shared drop/line effect validation, shared compiler normalization of nearby selectors, and shared runtime drop requirement evaluation.
- Added shared `ActivationEffectViewSchema` so line/drop view schemas do not duplicate the same effect view shape.
- Removed the semantic-only `GameGrantSelectorSchema` alias and used the actual resolved selector schema directly.
- Strengthened config validation: embedded effect grant ids must be globally unique across item effects and line effects, because grant ids are runtime selector facts, not local private labels.
- Added schema test coverage for duplicate grant ids across embedded effect sources.

Verification:
- `npm run format`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:optional`

Known unchanged warnings:
- Biome skips `game/arkini.assets.json` because it is larger than maxSize.
- `game:validate` reports existing unused packaged PNG resources.
- Vite reports the existing >500 kB chunk warning.
