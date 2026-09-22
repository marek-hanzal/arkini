import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";

interface ReadPlacementPlanQuantityProps {
	readonly plan: PlacementPlan;
}

/**
 * Reads the total emitted quantity represented by one placement plan.
 */
export const readPlacementPlanQuantityFn = ({ plan }: ReadPlacementPlanQuantityProps) => {
	return plan.spawn.length;
};
