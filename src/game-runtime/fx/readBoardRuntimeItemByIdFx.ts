import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
	const boardItem = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeItem));
	if (boardItem !== undefined) return boardItem;
	return yield* Effect.fail(
		new ItemNotOnBoardError({
			itemId: runtimeItem.id,
			location: runtimeItem.location,
		}),
	);
});
