import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { PlacementFailureReasonEnumSchema } from "~/v1/placement/schema/PlacementFailureReasonEnumSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
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
	const remainingQuantity = quantity - placedQuantity;
	if (remainingQuantity <= 0) {
		return plan;
	}

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason,
			remainingQuantity,
		}),
	);
});
