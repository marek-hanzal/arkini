import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";

/** A placement planner produced more quantity than its resolved drop requested. */
export class PlacementPlanInvalidError extends Data.TaggedError("PlacementPlanInvalidError")<{
	itemId: IdSchema.Type;
	placement: PlacementEnumSchema.Type;
	requestedQuantity: PositiveIntegerSchema.Type;
	placedQuantity: PositiveIntegerSchema.Type;
}> {}
