import { Array, Effect, Option, pipe } from "effect";

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
	const [, candidates] = Array.mapAccum(items, quantity, (remainingQuantity, item) => {
		const availableQuantity = item.item.maxStackSize - item.quantity;
		const placedQuantity = Math.min(remainingQuantity, availableQuantity);

		return [
			remainingQuantity - placedQuantity,
			placedQuantity > 0
				? Option.some({
						itemId: item.id,
						quantity: placedQuantity,
					} satisfies PlacementPlanSchema.Type["stack"][number])
				: Option.none(),
		] as const;
	});

	return pipe(candidates, Array.getSomes);
});
