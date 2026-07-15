import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** A gameplay merge requires two distinct runtime item identities. */
export class MergeSameItemError extends Data.TaggedError("MergeSameItemError")<{
	itemId: IdSchema.Type;
}> {}
