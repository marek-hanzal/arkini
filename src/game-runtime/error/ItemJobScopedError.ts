import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** A generic item command targeted a resource exclusively owned by an active job. */
export class ItemJobScopedError extends Data.TaggedError("ItemJobScopedError")<{
	itemId: IdSchema.Type;
	jobId: IdSchema.Type;
}> {}
