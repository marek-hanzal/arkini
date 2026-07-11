import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";

/**
 * A runtime command targeted a location occupied by another live item.
 */
export class LocationOccupiedError extends Data.TaggedError("LocationOccupiedError")<{
	itemId: IdSchema.Type;
	location: LocationSchema.Type;
}> {}
