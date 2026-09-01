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

/** Reads distinct outputs whose authored operation directly inputs or positively requires one fact. */
export const readRequiredByFactIdsFn = (graph: AcquisitionGraph, factId: string) => {
	const requiredBy = new Set<string>();
	for (const source of readItemOriginSourcesFn(graph)) {
		const directInput = source.inputs.some((input) => input.itemId === factId);
		for (const output of source.outputs)
			if (
				output.itemId !== factId &&
				(directInput || requiresFactAsConditionFn(output.requirements, factId))
			)
				requiredBy.add(output.itemId);
	}
	return [
		...requiredBy,
	].sort(Order.String);
};
