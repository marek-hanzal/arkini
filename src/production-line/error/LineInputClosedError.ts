import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

/** A material delivery targeted an input while its line was running. */
export class LineInputClosedError extends Data.TaggedError("LineInputClosedError")<{
	ownerItemId: IdSchema.Type;
	lineUid: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
}> {}
