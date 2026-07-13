import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** A live runtime job lookup found no job with the requested identity. */
export class JobNotFoundError extends Data.TaggedError("JobNotFoundError")<{
	jobId: IdSchema.Type;
}> {}
