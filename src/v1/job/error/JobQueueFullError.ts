import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** One line owner has no remaining active-job queue capacity. */
export class JobQueueFullError extends Data.TaggedError("JobQueueFullError")<{
	ownerItemId: IdSchema.Type;
	maxQueueSize: PositiveIntegerSchema.Type;
	queueSize: PositiveIntegerSchema.Type;
}> {}
