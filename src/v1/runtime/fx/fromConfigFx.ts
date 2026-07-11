import { Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/**
 * Builds an empty core runtime.
 *
 * Board and inventory grids start without occupied cells. Their configured
 * dimensions remain owned by `GameConfigFx` and are validated separately from
 * this sparse mutable runtime representation.
 */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	return {
		board: {
			cells: {},
		},
		inventory: {
			cells: {},
		},
	} satisfies RuntimeSchema.Type;
});
