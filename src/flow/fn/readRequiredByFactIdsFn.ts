import { Order } from "effect";

import type { AcquisitionGraph } from "~/flow/type/AcquisitionGraph";

/** Reads distinct authored output facts whose acquisition route directly requires one fact. */
export const readRequiredByFactIdsFn = (graph: AcquisitionGraph, factId: string) => {
	const requiredBy = new Set<string>();
	for (const route of graph.routes) {
		const requirements = [
			...route.requirements.allOf,
			...route.requirements.anyOf.flat(),
		];
		if (requirements.some((requirement) => requirement.factId === factId))
			requiredBy.add(route.output.factId);
	}
	return [
		...requiredBy,
	].sort(Order.String);
};
