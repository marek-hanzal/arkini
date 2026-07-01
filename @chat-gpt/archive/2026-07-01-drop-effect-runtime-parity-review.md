# Drop-owned effect runtime parity review

Context: After the drop-owned effect refactor and longer Town Hall upgrade timing, ran a deep review pass over schema/runtime/UI parity around product-line output effects.

Findings fixed:
- Producers could still start a product line when all visible output drops were disabled by drop-owned effects. Runtime now rejects scheduled starts with `effect:disabled-output`, and UI run-state now blocks the action with `Drops disabled`.
- Disabled duplicate drops could leak an active bonus chance through an enabled sibling with the same item id. Chance entries now carry their concrete `sourceDropId` and are filtered by enabled source drop, not just by item id.
- Drop start requirements could accidentally re-enable an earlier disabled drop. Start requirements now act as gates: ready leaves the current enabled state alone, missing disables.
- Stash/drop UI could show disabled weighted entries with misleading non-zero odds. Disabled weighted entries now show `0%/roll`.

Verification after the pass:
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test`
- `npm run build`
