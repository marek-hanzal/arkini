import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";

/**
 * An item lookup found no canonical item or no live item at one location.
 */
export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
	itemId?: IdSchema.Type;
	location?: LocationSchema.Type;
}> {}
