import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Reads one board line together with its exact live owner. */
export const readBoardItemLineFx = Effect.fn("readBoardItemLineFx")(function* ({
	lineUid,
	ownerItemId,
	runtime,
}: {
	readonly lineUid: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const owner = yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const line = readItemLineFn({
		item: owner.item,
		lineUid,
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
			lineUid,
		}),
	);
});
