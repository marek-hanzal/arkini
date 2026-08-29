import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads one exact runtime item and asserts that it currently owns a board location. */
export const readBoardRuntimeItemByIdFx = Effect.fn("readBoardRuntimeItemByIdFx")(function* ({
	itemId,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const runtimeItem = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const boardItem = Option.getOrUndefined(isBoardRuntimeItemFn(runtimeItem));
	if (boardItem !== undefined) return boardItem;
	return yield* Effect.fail(
		new ItemNotOnBoardError({
			itemId: runtimeItem.id,
			location: runtimeItem.location,
		}),
	);
});
