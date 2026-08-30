import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";

/** A material delivery targeted a zero-capacity input while its line was running. */
export class LineInputClosedError extends Data.TaggedError("LineInputClosedError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
}> {}
