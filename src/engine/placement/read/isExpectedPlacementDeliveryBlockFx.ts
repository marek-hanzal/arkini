import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";

/** Keeps only the placement failures that may legitimately defer output delivery. */
export const isExpectedPlacementDeliveryBlockFx = Effect.fn("isExpectedPlacementDeliveryBlockFx")(
	function* (reason: PlacementUnavailableError.Reason) {
		return match(reason)
			.with(PlacementUnavailableError.Reason.BoardOriginUnavailable, () => false)
			.with(
				P.union(
					PlacementUnavailableError.Reason.BoardFull,
					PlacementUnavailableError.Reason.InventoryFull,
					PlacementUnavailableError.Reason.ToolbarFull,
					PlacementUnavailableError.Reason.ItemMaxCount,
				),
				() => true,
			)
			.exhaustive();
	},
);
