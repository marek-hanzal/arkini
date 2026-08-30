import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";

/** One runtime item cannot pay an authored positive charge cost. */
export class ItemChargesUnavailableError extends Data.TaggedError("ItemChargesUnavailableError")<{
	itemId: IdSchema.Type;
	cost: PositiveIntegerSchema.Type;
	remainingCharges: number;
}> {}
