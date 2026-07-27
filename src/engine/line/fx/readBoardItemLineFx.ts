import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { readBoardRuntimeItemByIdFx } from "~/engine/runtime/read/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const line = yield* readItemLineFx({
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
