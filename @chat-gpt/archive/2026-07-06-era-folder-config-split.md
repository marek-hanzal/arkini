# 2026-07-06 — era folder config split

- replaced monolithic `game/arkini/era-*.json` files with era folders
- split each era into small JSON fragments grouped by `items/`, `producers/`, and `blueprints/`
- kept `game/arkini/game.json` for shared assets, global game metadata, and starting state
- confirmed the compiler already recursively reads source directories through `findFiles`
- added a compiler regression test for nested source fragments
- ensured every source JSON fragment has a relative `$schema` reference to `game/arkini.schema.json`
- added an audit guardrail so source JSON files without valid `$schema` references fail `npm run audit:current`
