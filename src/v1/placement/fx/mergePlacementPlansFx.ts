import { Effect } from "effect";

import type { PlacementPlanSchema } from "~/v1/placement/schema/PlacementPlanSchema";

export namespace mergePlacementPlansFx {
	export interface Props {
		plans: ReadonlyArray<PlacementPlanSchema.Type>;
	}
}

/**
 * Combines ordered placement plan fragments into one atomic plan.
 */
export const mergePlacementPlansFx = Effect.fn("mergePlacementPlansFx")(function* ({
	plans,
}: mergePlacementPlansFx.Props) {
	return {
		remove: plans.flatMap((plan) => plan.remove),
		spawn: plans.flatMap((plan) => plan.spawn),
		stack: plans.flatMap((plan) => plan.stack),
	} satisfies PlacementPlanSchema.Type;
});
