# Forest seed chance drop

User requested that watering a mature micro-forest should have a chance to drop a seed instead of always creating one.

Implemented as content/model usage, not a forest-specific runtime branch:

- `game/arkini/era-I.json`: `item:water` merge with `item:micro-forest` keeps the target and uses `output: [{ type: "chance", chance: 0.35, itemId: "item:seed", quantity: 1 }]`.
- Recompiled `game/arkini.game.json` from authoring config.
- `src/merge/applyGameActionMergeFx.test.ts`: keep-target merge now has deterministic tests for winning and losing the chance roll.
- `src/engine/applyGameActionFx.testSupport.ts`: added `runActionWithRandom` so runtime tests can inject a non-default random service without duplicating Effect boilerplate.

Important behavior: water is always consumed, micro-forest is kept, seed is created only on a successful chance roll.
