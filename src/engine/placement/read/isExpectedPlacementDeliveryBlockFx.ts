import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

/** Keeps only the placement failures that may legitimately defer output delivery. */
export const isExpectedPlacementDeliveryBlockFx = Effect.fn("isExpectedPlacementDeliveryBlockFx")(
	function* (reason: PlacementFailureReasonEnumSchema.Type) {
		return match(reason)
			.with(PlacementFailureReasonEnumSchema.enum.BoardOriginUnavailable, () => false)
			.with(
				P.union(
					PlacementFailureReasonEnumSchema.enum.BoardFull,
					PlacementFailureReasonEnumSchema.enum.InventoryFull,
					PlacementFailureReasonEnumSchema.enum.ToolbarFull,
					PlacementFailureReasonEnumSchema.enum.ItemMaxCount,
				),
				() => true,
			)
			.exhaustive();
	},
);
