import type { EstimateTopology } from "~/estimate/fn/createEstimateTopologyFn";

/** Credits one authored root pool before Estimate plans the remaining quantity. */
export const readEstimateMissingQuantityFn = (
	topology: EstimateTopology,
	factId: string,
	quantity: number,
) => {
	const root = topology.roots.get(factId);
	return quantity - (root === "unbounded" ? quantity : Math.min(root ?? 0, quantity));
};
