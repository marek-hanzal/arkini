import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { LocationSchema } from "~/engine/location/schema/LocationSchema";

/**
 * A grid-only runtime operation targeted an item stored outside board/inventory.
 */
export class ItemNotOnGridError extends Data.TaggedError("ItemNotOnGridError")<{
	itemId: IdSchema.Type;
	location: LocationSchema.Type;
}> {}
