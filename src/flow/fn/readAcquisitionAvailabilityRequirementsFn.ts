import { Order } from "effect";

import type {
	AcquisitionRequirement,
	AcquisitionUnsupportedRequirement,
} from "~/flow/type/AcquisitionGraph";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

export namespace readAcquisitionAvailabilityRequirementsFn {
	export interface Props {
		readonly rules: ReadonlyArray<{
			readonly type: string;
			readonly when: ReadonlyArray<WhenSchema.Type>;
		}>;
		readonly source: "line-condition" | "output-condition";
	}
}

const readSatisfyQuantityFn = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return 1;
		case "count":
			return when.count;
		case "range":
			return when.min;
	}
};

const readFalsifyQuantityFn = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return undefined;
		case "count":
			return when.count === 0 ? 1 : undefined;
		case "range":
			return when.min === 0 ? when.max + 1 : undefined;
	}
};

const makeRequirementFn = (
	when: WhenSchema.Type,
	quantity: number,
	source: "line-condition" | "output-condition",
): AcquisitionRequirement => ({
	factId: when.query.selector.itemId,
	quantity,
	source,
	usage: "ongoing",
});

const addUnsupportedRequirementFn = (
	unsupported: AcquisitionUnsupportedRequirement[],
	when: WhenSchema.Type,
	reason: AcquisitionUnsupportedRequirement["reason"],
	source: "line-condition" | "output-condition",
) =>
	unsupported.push({
		factId: when.query.selector.itemId,
		reason,
		source,
	});

/** Projects authored enable/disable conditions into positive static facts. */
export const readAcquisitionAvailabilityRequirementsFn = ({
	rules,
	source,
}: readAcquisitionAvailabilityRequirementsFn.Props) => {
	const allOf: AcquisitionRequirement[] = [];
	const anyOf: AcquisitionRequirement[][] = [];
	const unsupported: AcquisitionUnsupportedRequirement[] = [];
	for (const rule of rules) {
		if (rule.type === "enable") {
			for (const when of rule.when) {
				const quantity = readSatisfyQuantityFn(when);
				if (quantity !== undefined && quantity > 0)
					allOf.push(makeRequirementFn(when, quantity, source));
				if (when.type === "count")
					addUnsupportedRequirementFn(unsupported, when, "exact-count", source);
				if (when.type === "range")
					addUnsupportedRequirementFn(unsupported, when, "upper-bound", source);
			}
			continue;
		}
		if (rule.type !== "disable") continue;
		const alternatives: AcquisitionRequirement[] = [];
		let factFree = false;
		for (const when of rule.when) {
			const quantity = readFalsifyQuantityFn(when);
			if (quantity === undefined) {
				addUnsupportedRequirementFn(unsupported, when, "negative-condition", source);
				factFree = true;
				break;
			}
			alternatives.push(makeRequirementFn(when, quantity, source));
		}
		if (!factFree && alternatives.length > 0) anyOf.push(alternatives);
	}
	const compare = (left: AcquisitionRequirement, right: AcquisitionRequirement) =>
		Order.String(left.factId, right.factId) || left.quantity - right.quantity;
	return {
		allOf: allOf.sort(compare),
		anyOf: anyOf.map((clause) => clause.sort(compare)),
		...(unsupported.length === 0
			? {}
			: {
					unsupported: unsupported.sort(
						(left, right) =>
							Order.String(left.factId, right.factId) ||
							Order.String(left.reason, right.reason),
					),
				}),
	};
};
