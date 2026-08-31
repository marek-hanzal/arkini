import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";

/** A live runtime job was routed to completion before all of its work finished. */
export class JobNotReadyError extends Data.TaggedError("JobNotReadyError")<{
	jobId: IdSchema.Type;
	remainingMs: TimeSchema.Type;
}> {}
