# Item detail limit-reached product-line collapse

Follow-up UI pass for product lines whose target/output limit is already reached.

Changes made:
- Product lines with `outputLimitBlocked` now collapse to the line header plus disabled primary action label.
- Detailed output, target-limit, requirement, input, withdraw, and default-toggle sections stay hidden in this state; the action button already communicates the blocker.
- Regression coverage locks this behavior so target-limited blueprint/craft-like lines do not waste vertical space with unusable inputs and duplicate limit explanations.

Validation:
- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- src/v0/item-detail/ui/DetailProducerLinesPanel.test.tsx`
- `npm run test`
- `npm run build`
