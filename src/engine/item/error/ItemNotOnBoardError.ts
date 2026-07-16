import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { LocationSchema } from "~/engine/location/schema/LocationSchema";

/** A board-spatial operation targeted an item outside the board. */
export class ItemNotOnBoardError extends Data.TaggedError("ItemNotOnBoardError")<{
	itemId: IdSchema.Type;
	location: LocationSchema.Type;
}> {}
