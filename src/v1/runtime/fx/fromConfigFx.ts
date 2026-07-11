import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/**
 * Builds an empty runtime from the loaded game configuration.
 *
 * Board and inventory grids start without occupied cells. Their configured
 * dimensions remain owned by the game configuration and are validated
 * separately from this sparse runtime representation.
 */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	const config = yield* GameConfigFx;
	const result = {
		config,
		board: {
			cells: {},
		},
		inventory: {
			cells: {},
		},
	};

	return result satisfies RuntimeSchema.Type;
});
