import { Effect } from "effect";

import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface ApplyPlacementPlanProps {
	readonly plan: PlacementPlan;
	readonly runtime: RuntimeSchema.Type;
}

export namespace applyPlacementPlanFx {
	export interface Result {
		readonly remove: ReadonlyArray<RuntimeItemSchema.Type>;
		readonly spawn: ReadonlyArray<RuntimeItemSchema.Type>;
	}
}

/**
 * Applies one already validated placement plan to an immutable runtime draft.
 */
export const applyPlacementPlanFx = Effect.fn("applyPlacementPlanFx")(function* ({
	plan,
	runtime,
}: ApplyPlacementPlanProps) {
	const removedItems = runtime.items.filter((item) => plan.remove.includes(item.id));
	const updatedItems = runtime.items.filter((item) => !plan.remove.includes(item.id));
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
	} satisfies applyPlacementPlanFx.Result;

	return [
		result,
		nextRuntime,
	] as const;
});
