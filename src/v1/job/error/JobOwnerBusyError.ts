import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";

/** One runtime item cannot be removed while it still owns active or queued work. */
export class JobOwnerBusyError extends Data.TaggedError("JobOwnerBusyError")<{
	ownerItemId: IdSchema.Type;
	jobIds: IdSchema.Type[];
	requestIds: IdSchema.Type[];
}> {}
