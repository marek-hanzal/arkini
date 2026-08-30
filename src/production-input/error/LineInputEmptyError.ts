import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";

/** One exact material input no longer contains anything that can be withdrawn. */
export class LineInputEmptyError extends Data.TaggedError("LineInputEmptyError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
}> {}
