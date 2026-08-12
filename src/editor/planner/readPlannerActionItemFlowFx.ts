import { Effect } from "effect";

import type { PlannerSearchItemQuantity } from "~/editor/planner/PlannerSearch";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readPlannerActionItemFlowFx {
	export interface Props {
		readonly after: RuntimeSchema.Type;
		readonly before: RuntimeSchema.Type;
	}
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readQuantityByItemId = (runtime: RuntimeSchema.Type) => {
	const quantities = new Map<string, number>();
	for (const item of runtime.items)
		quantities.set(item.item.id, (quantities.get(item.item.id) ?? 0) + item.quantity);
	return quantities;
};

/** Reads net canonical item quantity flow committed by one completed planner action. */
export const readPlannerActionItemFlowFx = Effect.fn("readPlannerActionItemFlowFx")(
	({ after, before }: readPlannerActionItemFlowFx.Props) =>
		Effect.sync(() => {
			const beforeQuantity = readQuantityByItemId(before);
			const afterQuantity = readQuantityByItemId(after);
			const itemIds = new Set([
				...beforeQuantity.keys(),
				...afterQuantity.keys(),
			]);
			const consumedItemQuantities: PlannerSearchItemQuantity[] = [];
			const producedItemQuantities: PlannerSearchItemQuantity[] = [];

			for (const itemId of itemIds) {
				const difference =
					(afterQuantity.get(itemId) ?? 0) - (beforeQuantity.get(itemId) ?? 0);
				if (difference < 0)
					consumedItemQuantities.push({
						itemId,
						quantity: -difference,
					});
				if (difference > 0)
					producedItemQuantities.push({
						itemId,
						quantity: difference,
					});
			}

			consumedItemQuantities.sort((left, right) => compareIds(left.itemId, right.itemId));
			producedItemQuantities.sort((left, right) => compareIds(left.itemId, right.itemId));
			return {
				consumedItemQuantities,
				producedItemQuantities,
			};
		}),
);
