import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import type { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

/**
 * A resolved drop cannot be placed completely without violating placement rules.
 */
export class PlacementUnavailableError extends Data.TaggedError("PlacementUnavailableError")<{
	itemId: IdSchema.Type;
	placement: PlacementEnumSchema.Type;
	quantity: PositiveIntegerSchema.Type;
	reason: PlacementFailureReasonEnumSchema.Type;
	remainingQuantity: PositiveIntegerSchema.Type;
}> {}
