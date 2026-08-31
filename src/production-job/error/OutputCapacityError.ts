import { Data } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";

/** Starting one job would overbook a canonical item's worst-case future maxCount capacity. */
export class OutputCapacityError extends Data.TaggedError("OutputCapacityError")<{
	jobId: IdSchema.Type;
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	itemId: IdSchema.Type;
	liveQuantity: number;
	reservedQuantity: PositiveIntegerSchema.Type;
	maxCount: PositiveIntegerSchema.Type;
	excessQuantity: PositiveIntegerSchema.Type;
}> {}
