import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace planStackPlacementFx {
	export interface Props {
		items: ReadonlyArray<RuntimeItemSchema.Type>;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Plans quantity additions into compatible existing stacks without overflowing them.
 */
export const planStackPlacementFx = Effect.fn("planStackPlacementFx")(function* ({
	items,
	quantity,
}: planStackPlacementFx.Props) {
	let remainingQuantity = quantity;
	const stack: PlacementPlanSchema.Type["stack"] = [];

	for (const item of items) {
		if (remainingQuantity === 0) {
			break;
		}

		const availableQuantity = item.item.maxStackSize - item.quantity;
		const placedQuantity = Math.min(remainingQuantity, availableQuantity);
		if (placedQuantity === 0) {
			continue;
		}

		stack.push({
			itemId: item.id,
			quantity: placedQuantity,
		});
		remainingQuantity -= placedQuantity;
	}

	return stack;
});
