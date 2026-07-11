import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import { planInventoryPlacementFx } from "~/v1/placement/fx/planInventoryPlacementFx";
import { readPlacementPlanQuantityFx } from "~/v1/placement/fx/readPlacementPlanQuantityFx";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { StartInventoryUnavailableError } from "~/v1/start/error/StartInventoryUnavailableError";
import type { InventoryItemSchema } from "~/v1/start/schema/InventoryItemSchema";

export namespace planStartInventoryItemFx {
	export interface Props {
		item: InventoryItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Plans one complete initial inventory quantity in deterministic stack-first order.
 */
export const planStartInventoryItemFx = Effect.fn("planStartInventoryItemFx")(function* ({
	item: startItem,
	runtime,
}: planStartInventoryItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: startItem.itemId,
	});
	const plan = yield* planInventoryPlacementFx({
		item,
		quantity: startItem.quantity,
		runtime,
	});
	const placedQuantity = yield* readPlacementPlanQuantityFx({
		plan,
	});
	const remainingQuantity = startItem.quantity - placedQuantity;
	if (remainingQuantity > 0) {
		return yield* Effect.fail(
			new StartInventoryUnavailableError({
				itemId: startItem.itemId,
				quantity: startItem.quantity,
				remainingQuantity,
			}),
		);
	}

	return plan satisfies PlacementPlanSchema.Type;
});
