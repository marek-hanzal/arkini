import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * A runtime item does not own the requested product line.
 */
export class LineNotFoundError extends Data.TaggedError("LineNotFoundError")<{
	itemId: IdSchema.Type;
	lineId: IdSchema.Type;
}> {}
