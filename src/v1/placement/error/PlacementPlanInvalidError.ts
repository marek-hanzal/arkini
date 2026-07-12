import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";

/** A placement planner produced more quantity than its resolved drop requested. */
export class PlacementPlanInvalidError extends Data.TaggedError("PlacementPlanInvalidError")<{
	itemId: IdSchema.Type;
	placement: PlacementEnumSchema.Type;
	requestedQuantity: PositiveIntegerSchema.Type;
	placedQuantity: PositiveIntegerSchema.Type;
}> {}
