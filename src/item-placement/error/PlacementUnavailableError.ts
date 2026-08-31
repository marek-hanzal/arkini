import { Data } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";

const PlacementFailureReason = {
	ItemMaxCount: "item:max-count",
	BoardOriginUnavailable: "board:origin-unavailable",
	BoardFull: "board:full",
	InventoryFull: "inventory:full",
	ToolbarFull: "toolbar:full",
} as const;

type PlacementFailureReason = (typeof PlacementFailureReason)[keyof typeof PlacementFailureReason];

/**
 * A resolved drop cannot be placed completely without violating placement rules.
 */
export class PlacementUnavailableError extends Data.TaggedError("PlacementUnavailableError")<{
	itemId: IdSchema.Type;
	placement: PlacementSchema.Type;
	quantity: PositiveIntegerSchema.Type;
	reason: PlacementFailureReason;
	remainingQuantity: PositiveIntegerSchema.Type;
}> {}

export namespace PlacementUnavailableError {
	export const Reason = PlacementFailureReason;
	export type Reason = PlacementFailureReason;
}
