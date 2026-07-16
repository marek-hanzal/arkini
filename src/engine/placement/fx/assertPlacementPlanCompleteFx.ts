import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import { PlacementPlanInvalidError } from "~/engine/placement/error/PlacementPlanInvalidError";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace assertPlacementPlanCompleteFx {
	export interface Props {
		drop: DropResultSchema.Type;
		plan: PlacementPlanSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		reason: PlacementFailureReasonEnumSchema.Type;
	}
}

/**
 * Rejects one partial placement plan that does not cover its requested quantity.
 */
export const assertPlacementPlanCompleteFx = Effect.fn("assertPlacementPlanCompleteFx")(function* ({
	drop,
	plan,
	quantity,
	reason,
}: assertPlacementPlanCompleteFx.Props) {
	const placedQuantity = yield* readPlacementPlanQuantityFx({
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
