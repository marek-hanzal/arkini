import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";

/** A board-spatial operation targeted an item outside the board. */
export class ItemNotOnBoardError extends Data.TaggedError("ItemNotOnBoardError")<{
	itemId: IdSchema.Type;
	location: LocationSchema.Type;
}> {}
