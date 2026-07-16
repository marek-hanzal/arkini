import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * A runtime command attempted to create an already existing live item ID.
 */
export class ItemAlreadyExistsError extends Data.TaggedError("ItemAlreadyExistsError")<{
	itemId: IdSchema.Type;
}> {}
