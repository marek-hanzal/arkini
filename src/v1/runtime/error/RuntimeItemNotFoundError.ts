import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** A persisted state item references no canonical item in the loaded game. */
export class RuntimeItemNotFoundError extends Data.TaggedError("RuntimeItemNotFoundError")<{
	itemId: IdSchema.Type;
}> {}
