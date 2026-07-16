import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A cheat-inventory consume command requires distinct source and sink identities. */
export class CheatInventorySameItemError extends Data.TaggedError("CheatInventorySameItemError")<{
	itemId: IdSchema.Type;
}> {}
