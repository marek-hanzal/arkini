import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { InventoryLocationSchema } from "~/engine/location/schema/InventoryLocationSchema";
import type { ToolbarLocationSchema } from "~/engine/location/schema/ToolbarLocationSchema";
import { planSpawnPlacementFx } from "~/engine/placement/fx/planSpawnPlacementFx";
import { readPlacementPlanQuantityFx } from "~/engine/placement/fx/readPlacementPlanQuantityFx";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { StartSlotUnavailableError } from "~/engine/start/error/StartSlotUnavailableError";

type StartGridLocation =
	| BoardLocationSchema.Type
	| InventoryLocationSchema.Type
	| ToolbarLocationSchema.Type;

export namespace planStartExactGridStackFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly location: StartGridLocation;
		readonly quantity: PositiveIntegerSchema.Type;
	}
}

/** Plans one complete initial stack at one exact Board, Inventory, or Toolbar slot. */
export const planStartExactGridStackFx = Effect.fn("planStartExactGridStackFx")(function* ({
	itemId,
	location,
	quantity,
}: planStartExactGridStackFx.Props) {
	const item = yield* resolveItemFx({
		itemId,
	});
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: [
			location,
		],
		quantity,
	});
	const plan = {
		remove: [],
		spawn,
		stack: [],
	} satisfies PlacementPlanSchema.Type;
	const placedQuantity = yield* readPlacementPlanQuantityFx({
		plan,
	});
	if (placedQuantity !== quantity) {
		return yield* Effect.fail(
			new StartSlotUnavailableError({
				itemId,
				quantity,
				remainingQuantity: quantity - placedQuantity,
				scope: location.scope,
			}),
		);
	}
	return plan;
});
