# 2026-06-30 Effect no-op schema prune

Follow-up stability pass after line-owned effect cleanup.

## Findings

- `grant.loot.extraOutputChance.add` still accepted `chance: 0`, which is a UI-visible modifier that can never roll.
- `grant.duration.multiply` accepted `multiplier: 1`, which is a duration modifier that changes nothing.
- `nearby.duration.multiply` could be authored with every distance band at `multiplier: 1`, producing an aura-like bonus row with no gameplay impact.
- Runtime product-line view still exposed `blockReasonEffectIds`, but the values were line-local effect ids and no UI/runtime consumer used them. Keeping this field around invited future misuse.
- `src/v0/game/effects/doesResolvedDomainSelectorMatchId.ts` was only a one-line forwarding shim after selector extraction.

## Decisions

- Reject zero-chance bonus loot effects.
- Reject duration multipliers that do not change timing.
- Reject nearby duration effects where no band changes timing.
- Remove unused `blockReasonEffectIds` from product-line runtime views and tests.
- Delete the selector forwarding shim and import the selector helper directly from `game/selector`.

## Guardrail

Line-owned modifier effects must represent real runtime behavior. If UI can show it as a bonus/debuff, config validation should prevent it from being decorative nothing.
