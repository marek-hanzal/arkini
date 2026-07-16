import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readPlacementOriginFx {
	export interface Props {
		originItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Reads the current board origin used by output and drop placement.
 */
export const readPlacementOriginFx = Effect.fn("readPlacementOriginFx")(function* ({
	originItemId,
	runtime,
}: readPlacementOriginFx.Props) {
	const origin = yield* readRuntimeItemByIdFx({
		itemId: originItemId,
		runtime,
	});
	if (!isBoardRuntimeItem(origin)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: originItemId,
				location: origin.location,
			}),
		);
	}

	return origin satisfies BoardRuntimeItemSchema.Type;
});
