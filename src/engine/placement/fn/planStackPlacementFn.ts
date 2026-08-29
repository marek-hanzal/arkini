import { Array, Option, pipe } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { PlacementPlan } from "~/engine/placement/PlacementPlan";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

export namespace planStackPlacementFn {
	export interface Props {
		items: ReadonlyArray<RuntimeItemSchema.Type>;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Plans quantity additions into compatible existing stacks without overflowing them.
 */
export const planStackPlacementFn = ({ items, quantity }: planStackPlacementFn.Props) => {
	const [, candidates] = Array.mapAccum(items, quantity, (remainingQuantity, item) => {
		const availableQuantity = item.item.maxStackSize - item.quantity;
		const placedQuantity = Math.min(remainingQuantity, availableQuantity);

		return [
			remainingQuantity - placedQuantity,
			placedQuantity > 0
				? Option.some({
						itemId: item.id,
						quantity: placedQuantity,
					} satisfies PlacementPlan["stack"][number])
				: Option.none(),
		] as const;
	});

	return pipe(candidates, Array.getSomes);
};
