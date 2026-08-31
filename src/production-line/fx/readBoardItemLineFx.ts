import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Reads one board line together with its exact live owner. */
export const readBoardItemLineFx = Effect.fn("readBoardItemLineFx")(function* ({
	lineId,
	ownerItemId,
	runtime,
}: {
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const owner = yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const line = readItemLineFn({
		item: owner.item,
		lineId,
	});
	if (line !== undefined) {
		return {
			line,
			owner,
		} as const;
	}
	return yield* Effect.fail(
		new LineNotFoundError({
			itemId: owner.id,
			lineId,
		}),
	);
});
