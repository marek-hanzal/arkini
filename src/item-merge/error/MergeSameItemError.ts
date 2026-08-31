import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";

/** A gameplay merge requires two distinct runtime item identities. */
export class MergeSameItemError extends Data.TaggedError("MergeSameItemError")<{
	readonly itemId: IdSchema.Type;
}> {}
