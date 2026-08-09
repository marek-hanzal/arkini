import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { planSpawnPlacementFx } from "~/engine/placement/fx/planSpawnPlacementFx";
import { readPlacementPlanQuantityFx } from "~/engine/placement/fx/readPlacementPlanQuantityFx";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import { StartSlotUnavailableError } from "~/engine/start/error/StartSlotUnavailableError";
import type { ToolbarItemSchema } from "~/engine/start/schema/ToolbarItemSchema";

export namespace planStartToolbarItemFx {
	export interface Props {
		item: ToolbarItemSchema.Type;
	}
}

/**
 * Plans one exact initial toolbar item without fallback or location substitution.
 */
export const planStartToolbarItemFx = Effect.fn("planStartToolbarItemFx")(function* ({
	item: startItem,
}: planStartToolbarItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: startItem.itemId,
	});
	const quantity = startItem.quantity ?? 1;
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: [
			{
				position: startItem.position,
				scope: LocationScopeEnumSchema.enum.Toolbar,
			},
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
				itemId: startItem.itemId,
				quantity,
				remainingQuantity: quantity - placedQuantity,
				scope: LocationScopeEnumSchema.enum.Toolbar,
			}),
		);
	}

	return plan;
});
