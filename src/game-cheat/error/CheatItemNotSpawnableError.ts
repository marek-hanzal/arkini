import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** The configured item cannot be placed as one ordinary Board runtime item. */
export class CheatItemNotSpawnableError extends Data.TaggedError("CheatItemNotSpawnableError")<{
	readonly itemId: IdSchema.Type;
}> {}
