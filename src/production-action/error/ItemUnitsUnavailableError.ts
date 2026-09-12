import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** One runtime item cannot pay an authored positive unit cost. */
export class ItemUnitsUnavailableError extends Data.TaggedError("ItemUnitsUnavailableError")<{
	itemId: IdSchema.Type;
	cost: PositiveIntegerSchema.Type;
	remainingUnits: number;
}> {}
