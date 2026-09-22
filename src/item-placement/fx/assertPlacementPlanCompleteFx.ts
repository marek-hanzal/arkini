import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import { PlacementPlanInvalidError } from "~/item-placement/error/PlacementPlanInvalidError";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";

interface AssertPlacementPlanCompleteProps {
	readonly drop: ResolvedOutcome.Item;
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
	const placedQuantity = plan.spawn.length;
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
