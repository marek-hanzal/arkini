import { Data } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PlacementEnumSchema } from "~/v1/placement/schema/PlacementEnumSchema";
import type { PlacementFailureReasonEnumSchema } from "~/v1/placement/schema/PlacementFailureReasonEnumSchema";

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
