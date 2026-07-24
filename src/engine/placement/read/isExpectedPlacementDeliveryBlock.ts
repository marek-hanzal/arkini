import { match, P } from "ts-pattern";

import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

/** Keeps only the placement failures that may legitimately defer output delivery. */
export const isExpectedPlacementDeliveryBlock = (
	reason: PlacementFailureReasonEnumSchema.Type,
): boolean =>
	match(reason)
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
