# V0 producer auto-fill start

Implemented producer product auto-fill for empty `producer.product.start` input refs.

Behavior:

- Clicking / starting a product line without explicitly selected resources now auto-fills missing product inputs before the line starts.
- Already stored producer product inputs are used first.
- Board inputs are selected before inventory inputs, in deterministic board order (`y`, `x`, `id`).
- The producer tile itself is excluded from auto-fill source candidates.
- Inventory inputs are selected by slot order and can partially consume stacks.
- If total stored + board + inventory inputs cannot satisfy the line, readiness still rejects with `input_mismatch`.
- Auto-fill stores inputs into the producer product input state, emits `producer_input.stored`, then starts the product using the existing stored-input consumption path.
- Board auto-fill inputs emit `item.consumed` with reason `producer-input-store`; the visual planner maps these to a transient board tile flying into the producer.
- Inventory auto-fill inputs mutate inventory state without board visual motion.

UI:

- Producer product line view exposes `inputsAvailable`.
- Product line controls are enabled when direct stored inputs are ready or auto-fill resources are available.
- The detail card shows `auto-fill ready` and `Auto-fill & start` for lines that can be filled automatically.

Validation:

- `npm run format` passed with the existing Biome warning for large `game/arkini.assets.json`.
- `npm run typecheck` passed.
- `npm run test` passed: 50 files, 264 tests.
- `npm run game:validate -- game/arkini.game.json game/arkini.assets.json` passed.
- `npm run build` passed with the existing Vite chunk-size warning.

Note:

- `npm run check` was also attempted, but the sandbox command timeout clipped it during the Vitest phase. Its constituent checks were run successfully separately.
