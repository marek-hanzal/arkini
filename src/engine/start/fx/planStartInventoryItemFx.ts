import { Effect } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { planStartExactGridStackFx } from "~/engine/start/fx/planStartExactGridStackFx";
import type { InventoryItemSchema } from "~/engine/start/schema/InventoryItemSchema";

export namespace planStartInventoryItemFx {
	export interface Props {
		item: InventoryItemSchema.Type;
	}
}

/**
 * Plans one exact initial inventory stack.
 */
export const planStartInventoryItemFx = Effect.fn("planStartInventoryItemFx")(function* ({
	item: startItem,
}: planStartInventoryItemFx.Props) {
	return yield* planStartExactGridStackFx({
		itemId: startItem.itemId,
		location: {
			position: startItem.position,
			scope: LocationScopeEnumSchema.enum.Inventory,
		},
		quantity: startItem.quantity,
	});
});
