import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";

/** An item-location write targeted an item that no longer owns the expected grid location. */
export class ItemLocationConflictError extends Data.TaggedError("ItemLocationConflictError")<{
	itemId: IdSchema.Type;
	expectedLocation: GridLocationSchema.Type;
	actualLocation: GridLocationSchema.Type;
}> {}
