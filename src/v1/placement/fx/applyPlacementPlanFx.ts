import { Effect } from "effect";

import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";
import type { PlacementResultSchema } from "~/v1/placement/schema/PlacementResultSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace applyPlacementPlanFx {
	export interface Props {
		plan: PlacementPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Applies one already validated placement plan to an immutable runtime draft.
 */
export const applyPlacementPlanFx = Effect.fn("applyPlacementPlanFx")(function* ({
	plan,
	runtime,
}: applyPlacementPlanFx.Props) {
	const removedItems = runtime.items.filter((item) => plan.remove.includes(item.id));
	const stackByItemId = new Map(
		plan.stack.map((stack) => [
			stack.itemId,
			stack.quantity,
		]),
	);
	const stackResults: PlacementResultSchema.Type["stack"] = [];
	const updatedItems: RuntimeItemSchema.Type[] = [];

	for (const item of runtime.items) {
		if (plan.remove.includes(item.id)) {
			continue;
		}

		const addedQuantity = stackByItemId.get(item.id);
		if (addedQuantity === undefined) {
			updatedItems.push(item);
			continue;
		}

		const updatedItem = {
			...item,
			quantity: item.quantity + addedQuantity,
		} satisfies RuntimeItemSchema.Type;
		updatedItems.push(updatedItem);
		stackResults.push({
			item: updatedItem,
			quantity: addedQuantity,
		});
	}

	const spawnedItems = plan.spawn.map(({ item }) => item);
	const nextRuntime = {
		items: [
			...updatedItems,
			...spawnedItems,
		],
	} satisfies RuntimeSchema.Type;
	const result = {
		remove: removedItems,
		spawn: spawnedItems,
		stack: stackResults,
	} satisfies PlacementResultSchema.Type;

	return [
		result,
		nextRuntime,
	] as const;
});
