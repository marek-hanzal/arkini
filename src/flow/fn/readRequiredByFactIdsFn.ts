import { Order } from "effect";

import { readItemOriginSourcesFn } from "~/flow/fn/readItemOriginSourcesFn";
import type { AcquisitionGraph } from "~/flow/type/AcquisitionGraph";
import type { ItemOriginOutputRequirements } from "~/flow/type/ItemOriginSource";

const requiresFactAsConditionFn = (requirements: ItemOriginOutputRequirements, factId: string) =>
	[
		...requirements.allOf,
		...requirements.anyOf.flat(),
	].some(
		(requirement) =>
			requirement.itemId === factId &&
			requirement.sources.some(
				(source) => source === "line-condition" || source === "output-condition",
			),
	);

/** Reads distinct authored operation owners that directly input or positively require one fact. */
export const readRequiredByFactIdsFn = (graph: AcquisitionGraph, factId: string) => {
	const requiredBy = new Set<string>();
	for (const source of readItemOriginSourcesFn(graph)) {
		const directInput = source.inputs.some((input) => input.itemId === factId);
		const requiredAsCondition = source.outputs.some((output) =>
			requiresFactAsConditionFn(output.requirements, factId),
		);
		if (source.ownerItemId !== factId && (directInput || requiredAsCondition))
			requiredBy.add(source.ownerItemId);
	}
	return [
		...requiredBy,
	].sort(Order.String);
};
