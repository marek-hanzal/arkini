import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { planSpawnPlacementFx } from "~/engine/placement/fx/planSpawnPlacementFx";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
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
	const spawn = yield* planSpawnPlacementFx({
		item,
		locations: [
			{
				position: startItem.position,
				scope: LocationScopeEnumSchema.enum.Toolbar,
			},
		],
		quantity: 1,
	});

	return {
		remove: [],
		spawn,
		stack: [],
	} satisfies PlacementPlanSchema.Type;
});
