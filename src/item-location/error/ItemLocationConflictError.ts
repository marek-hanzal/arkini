import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

/** An item-location write targeted an item that no longer owns the expected grid location. */
export class ItemLocationConflictError extends Data.TaggedError("ItemLocationConflictError")<{
	itemId: IdSchema.Type;
	expectedLocation: BoardLocationSchema.Type;
	actualLocation: BoardLocationSchema.Type;
}> {}
