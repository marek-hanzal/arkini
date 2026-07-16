import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A two-item swap requires two distinct runtime identities. */
export class SwapSameItemError extends Data.TaggedError("SwapSameItemError")<{
	itemId: IdSchema.Type;
}> {}
