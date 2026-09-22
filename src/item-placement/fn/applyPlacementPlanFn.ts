import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Applies an already validated spawn plan to an immutable runtime draft. */
export const applyPlacementPlanFn = ({
	plan,
	runtime,
}: {
	readonly plan: PlacementPlan;
	readonly runtime: RuntimeSchema.Type;
}): RuntimeSchema.Type => ({
	...runtime,
	items: [
		...runtime.items,
		...plan.spawn,
	],
});
