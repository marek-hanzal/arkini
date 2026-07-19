import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/** A write targeted an item that no longer owns the expected grid location. */
export class ItemLocationConflictError extends Data.TaggedError("ItemLocationConflictError")<{
	itemId: IdSchema.Type;
	expectedLocation: GridLocationSchema.Type;
	actualLocation: GridLocationSchema.Type;
}> {}
