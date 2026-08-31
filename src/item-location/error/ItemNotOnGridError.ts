import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";

/**
 * A grid-only runtime operation targeted an item outside Board, Inventory, or Toolbar.
 */
export class ItemNotOnGridError extends Data.TaggedError("ItemNotOnGridError")<{
	itemId: IdSchema.Type;
	location: LocationSchema.Type;
}> {}
