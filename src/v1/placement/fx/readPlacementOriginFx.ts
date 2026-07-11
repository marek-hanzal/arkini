import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotOnGridError } from "~/v1/item/error/ItemNotOnGridError";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace readPlacementOriginFx {
	export interface Props {
		originItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Reads the current grid origin used by output and drop placement.
 */
export const readPlacementOriginFx = Effect.fn("readPlacementOriginFx")(function* ({
	originItemId,
	runtime,
}: readPlacementOriginFx.Props) {
	const origin = yield* readRuntimeItemByIdFx({
		itemId: originItemId,
		runtime,
	});
	if (!isGridRuntimeItem(origin)) {
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId: originItemId,
				location: origin.location,
			}),
		);
	}

	return origin satisfies GridRuntimeItemSchema.Type;
});
