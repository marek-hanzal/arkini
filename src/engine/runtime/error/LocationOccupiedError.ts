import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/**
 * A runtime command targeted a location occupied by another live item.
 */
export class LocationOccupiedError extends Data.TaggedError("LocationOccupiedError")<{
	itemId: IdSchema.Type;
	location: GridLocationSchema.Type;
}> {}
