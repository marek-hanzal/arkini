import { Effect } from "effect";

import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import type { PlacementResultSchema } from "~/engine/placement/schema/PlacementResultSchema";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const stackResults: PlacementResultSchema.Type["stack"] = [];
	const updatedItems: RuntimeItemSchema.Type[] = [];

	for (const item of runtime.items) {
		if (plan.remove.includes(item.id)) {
			continue;
		}

		const stack = plan.stack.find((candidate) => candidate.itemId === item.id);
		if (stack === undefined) {
			updatedItems.push(item);
			continue;
		}

		const pure = yield* isItemPureFx({
			item,
			runtime,
		});
		if (!pure) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: item.id,
				}),
			);
		}

		const updatedItem = yield* reviseRuntimeItemFx({
			item: {
				...item,
				quantity: item.quantity + stack.quantity,
			} satisfies RuntimeItemSchema.Type,
		});
		updatedItems.push(updatedItem);
		stackResults.push({
			item: updatedItem,
			quantity: stack.quantity,
		});
	}

	const spawnedItems = plan.spawn.map(({ item }) => item);
	const nextRuntime = {
		...runtime,
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
