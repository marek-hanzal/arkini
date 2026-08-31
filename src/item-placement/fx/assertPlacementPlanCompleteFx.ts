import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import type { dropFx } from "~/production-output/fx/dropFx";
import { PlacementPlanInvalidError } from "~/item-placement/error/PlacementPlanInvalidError";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { readPlacementPlanQuantityFn } from "~/item-placement/fn/readPlacementPlanQuantityFn";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";

interface AssertPlacementPlanCompleteProps {
	readonly drop: dropFx.Result;
	readonly plan: PlacementPlan;
	readonly quantity: PositiveIntegerSchema.Type;
	readonly reason: PlacementUnavailableError.Reason;
}

/**
 * Rejects one partial placement plan that does not cover its requested quantity.
 */
export const assertPlacementPlanCompleteFx = Effect.fn("assertPlacementPlanCompleteFx")(function* ({
	drop,
	plan,
	quantity,
	reason,
}: AssertPlacementPlanCompleteProps) {
	const placedQuantity = readPlacementPlanQuantityFn({
		plan,
	});
	if (placedQuantity === quantity) {
		return plan;
	}
	if (placedQuantity > quantity) {
		return yield* Effect.fail(
			new PlacementPlanInvalidError({
				itemId: drop.itemId,
				placement: drop.placement,
				requestedQuantity: quantity,
				placedQuantity,
			}),
		);
	}

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason,
			remainingQuantity: quantity - placedQuantity,
		}),
	);
});
