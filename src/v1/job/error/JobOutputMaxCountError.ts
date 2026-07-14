import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** Starting one job would overbook a canonical item's worst-case future maxCount capacity. */
export class JobOutputMaxCountError extends Data.TaggedError("JobOutputMaxCountError")<{
	jobId: IdSchema.Type;
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	itemId: IdSchema.Type;
	liveQuantity: number;
	reservedQuantity: PositiveIntegerSchema.Type;
	maxCount: PositiveIntegerSchema.Type;
	excessQuantity: PositiveIntegerSchema.Type;
}> {}
