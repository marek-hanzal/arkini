import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** A snapshot-derived input run plan no longer matches its immutable draft. */
export class InputRunPlanInvalidError extends Data.TaggedError("InputRunPlanInvalidError")<{
	ownerItemId: IdSchema.Type;
	lineId: IdSchema.Type;
	inputIndex: NonNegativeIntegerSchema.Type;
	itemId: IdSchema.Type;
	plannedQuantity: PositiveIntegerSchema.Type;
	availableQuantity?: PositiveIntegerSchema.Type;
}> {}
