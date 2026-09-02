import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { TimeSchema } from "~/game-value/schema/TimeSchema";

/** A live runtime job was routed to completion before all of its work finished. */
export class JobNotReadyError extends Data.TaggedError("JobNotReadyError")<{
	jobId: IdSchema.Type;
	remainingMs: TimeSchema.Type;
}> {}
