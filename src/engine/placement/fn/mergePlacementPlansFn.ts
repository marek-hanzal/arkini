import type { PlacementPlan } from "~/engine/placement/PlacementPlan";

export namespace mergePlacementPlansFn {
	export interface Props {
		plans: ReadonlyArray<PlacementPlan>;
	}
}

/**
 * Combines ordered placement plan fragments into one atomic plan.
 */
export const mergePlacementPlansFn = ({ plans }: mergePlacementPlansFn.Props) => {
	return {
		remove: plans.flatMap((plan) => plan.remove),
		spawn: plans.flatMap((plan) => plan.spawn),
		stack: plans.flatMap((plan) => plan.stack),
	} satisfies PlacementPlan;
};
