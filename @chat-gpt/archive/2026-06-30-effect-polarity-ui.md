# 2026-06-30 Effect polarity UI

Added explicit `polarity: "buff" | "debuff" | "neutral" | "mixed"` to runtime effect definitions. This is authoring/display metadata only: runtime grant truth still comes from `grantIds`, `sourceScope`, passive item sources, and timed active effect product lines. UI must not infer effect meaning from multiplier math, operation kind, label text, or output chance.

Implementation notes:

- `GameConfigSchema` now requires `effects.*.polarity`.
- `game/arkini/effects.json` and compiled `game/arkini.game.json` include polarity on every effect.
- Current content marks owned grants and path grants as `neutral`; shrine active effects are `buff`.
- Producer product line runtime views expose `effectPolarity` for `activatesEffectId` lines.
- Item catalog generated effects include polarity.
- `ItemProducerProductLinesCard` groups effect product lines into Buffs, Debuffs, Neutral effects, and Mixed effects.
- `ItemGeneratedEffectsCard` groups passive/generated effects the same way.
- Added schema, bridge, and UI tests around mandatory polarity and grouping.

Guardrail: future effects with both upside and downside should be authored as `mixed` instead of trying to be clever. Cleverness is how a debuff becomes green because someone divided by 0.75 and called it vibes.
