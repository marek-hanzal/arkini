import { Data } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";

/** A placement planner produced more quantity than its resolved drop requested. */
export class PlacementPlanInvalidError extends Data.TaggedError("PlacementPlanInvalidError")<{
	readonly itemId: IdSchema.Type;
	readonly placement: PlacementSchema.Type;
	readonly requestedQuantity: PositiveIntegerSchema.Type;
	readonly placedQuantity: PositiveIntegerSchema.Type;
}> {}
