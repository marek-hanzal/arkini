import { Order } from "effect";

import type {
	AcquisitionRequirement,
	AcquisitionUnsupportedRequirement,
} from "~/flow/type/AcquisitionGraph";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

export namespace readAcquisitionAvailabilityRequirementsFn {
	export interface Props {
		readonly items: GameConfigSchema.Type["items"];
		readonly rules: ReadonlyArray<{
			readonly type: string;
			readonly when: ReadonlyArray<WhenSchema.Type>;
		}>;
		readonly source: "line-condition" | "output-condition";
	}
}

const readSatisfyQuantityFn = (when: WhenSchema.Type, items: GameConfigSchema.Type["items"]) => {
	switch (when.type) {
		case "limit":
			return items[when.itemId]?.maxCount;
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
		case "limit":
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
	factId: when.type === "limit" ? when.itemId : when.query.selector.itemId,
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
		factId: when.type === "limit" ? when.itemId : when.query.selector.itemId,
		reason,
		source,
	});

/** Projects authored enable/disable conditions into positive static facts. */
export const readAcquisitionAvailabilityRequirementsFn = ({
	items,
	rules,
	source,
}: readAcquisitionAvailabilityRequirementsFn.Props) => {
	const allOf: AcquisitionRequirement[] = [];
	const anyOf: AcquisitionRequirement[][] = [];
	const unsupported: AcquisitionUnsupportedRequirement[] = [];
	for (const rule of rules) {
		if (rule.type === "enable") {
			for (const when of rule.when) {
				const quantity = readSatisfyQuantityFn(when, items);
				if (quantity !== undefined && quantity > 0)
					allOf.push(makeRequirementFn(when, quantity, source));
				if (when.type === "limit" && quantity === undefined)
					addUnsupportedRequirementFn(unsupported, when, "uncapped-limit", source);
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
			// An uncapped Limit is always false, so the complete Disable conjunction cannot veto.
			if (when.type === "limit" && items[when.itemId]?.maxCount === undefined) {
				factFree = true;
				break;
			}
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
	const compareFn = (left: AcquisitionRequirement, right: AcquisitionRequirement) =>
		Order.String(left.factId, right.factId) || left.quantity - right.quantity;
	return {
		allOf: allOf.sort(compareFn),
		anyOf: anyOf.map((clause) => clause.sort(compareFn)),
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
