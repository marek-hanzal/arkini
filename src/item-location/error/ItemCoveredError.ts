import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";

/** A direct interaction cannot reach an item covered by another Board occupant. */
export class ItemCoveredError extends Data.TaggedError("ItemCoveredError")<{
	readonly itemId: IdSchema.Type;
}> {}
