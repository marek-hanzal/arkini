import { Effect } from "effect";

import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { ItemCoveredError } from "~/item-location/error/ItemCoveredError";
import { readGridLocationOccupantFn } from "~/item-location/fn/readGridLocationOccupantFn";

/** Rechecks direct interaction exposure against the serialized runtime snapshot. */
export const assertGridItemExposedFx = Effect.fn("assertGridItemExposedFx")(function* ({
	item,
	runtime,
}: {
	readonly item: GridRuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (
		readGridLocationOccupantFn({
			runtime,
			location: item.location,
		})?.id !== item.id
	) {
		return yield* Effect.fail(
			new ItemCoveredError({
				itemId: item.id,
			}),
		);
	}
});
