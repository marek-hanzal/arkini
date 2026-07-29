import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";

import { createBoardRectangleFx } from "./createBoardRectangleFx";

/** Projects one canonical item at a Board anchor to its occupied rectangle. */
export const readBoardItemRectangleFx = Effect.fn("readBoardItemRectangleFx")(function* ({
	anchor,
	item,
}: {
	readonly anchor: BoardLocationSchema.Type;
	readonly item: ItemSchema.Type;
}) {
	return yield* createBoardRectangleFx({
		anchor,
		footprint: item.footprint,
	});
});
