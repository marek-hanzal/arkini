import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/**
 * Builds an empty runtime from the loaded game configuration.
 *
 * The board starts without items. Inventory starts with its configured number
 * of slots, each explicitly empty, so the runtime immediately matches the
 * configured layout even before state or starting items are applied.
 */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	const config = yield* GameConfigFx;
	const inventorySize = config.meta.inventory.width * config.meta.inventory.height;
	const result = {
		config,
		board: {
			items: [],
		},
		inventory: {
			slots: Array.from(
				{
					length: inventorySize,
				},
				() => {
					return null;
				},
			),
		},
	};

	return result satisfies RuntimeSchema.Type;
});
