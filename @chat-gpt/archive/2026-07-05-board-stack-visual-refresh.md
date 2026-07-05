# Board stack visual refresh

Completed pass for board-stack regressions:

- Board view equality now includes `quantity`, so board stack count badges update immediately after stack/merge/producer placement instead of waiting for DnD to force a refresh.
- Existing board-stack increments now use a stack-specific visual path instead of treating the existing stack tile as a fresh board enter.
- Producer output into an existing board stack creates a transient output tile from the producer and flies it to the stack, then bounces the stack.
- Board stack actions pair the `item.consumed` source with the following `item.created` stack target event, skip the generic created enter, fly a transient from source to target when the source is on board, and bounce the target stack.
- `resolveDropIntent` test wording now reflects current same-item stack behavior: stack remains merge-like feedback in the UI, but is not a plank-producing regular merge.

Validation run:

- `npm run format:check`
- `npm run audit:current`
- `npm run game:schema:check`
- `npm run dc`
- `npm run typecheck`
- `npm run game:validate -- game/arkini` (valid with known limited-deposit warnings)
- targeted Vitest coverage for board stack visuals, runtime board item equality, drop intent, board/inventory stack placement, and placement.
- additional split Vitest chunks for the tests not completed in the all-in-one run before tool timeout.
- `npm run build` (passed with the existing large chunk warning)
