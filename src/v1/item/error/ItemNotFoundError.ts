import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";

/**
 * An item lookup found no canonical item or no live item at one location.
 */
export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
	itemId?: IdSchema.Type;
	location?: LocationSchema.Type;
}> {}
