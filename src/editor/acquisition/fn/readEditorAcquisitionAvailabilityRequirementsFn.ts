import { Order } from "effect";

import type {
	EditorAcquisitionRequirement,
	EditorAcquisitionUnsupportedRequirement,
} from "~/editor/EditorAcquisitionGraph";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export namespace readEditorAcquisitionAvailabilityRequirementsFn {
	export interface Props {
		readonly rules: ReadonlyArray<{
			readonly type: string;
			readonly when: ReadonlyArray<WhenSchema.Type>;
		}>;
		readonly source: "line-condition" | "output-condition";
	}
}

const readSatisfyQuantity = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return 1;
		case "count":
			return when.count;
		case "range":
			return when.min;
	}
};

const readFalsifyQuantity = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return undefined;
		case "count":
			return when.count === 0 ? 1 : undefined;
		case "range":
			return when.min === 0 ? when.max + 1 : undefined;
	}
};

const makeRequirement = (
	when: WhenSchema.Type,
	quantity: number,
	source: "line-condition" | "output-condition",
): EditorAcquisitionRequirement => ({
	factId: when.query.selector.itemId,
	quantity,
	source,
	usage: "ongoing",
});

/** Projects authored enable/disable conditions into positive static facts. */
export const readEditorAcquisitionAvailabilityRequirementsFn = ({
	rules,
	source,
}: readEditorAcquisitionAvailabilityRequirementsFn.Props) => {
	const allOf: EditorAcquisitionRequirement[] = [];
	const anyOf: EditorAcquisitionRequirement[][] = [];
	const unsupported: EditorAcquisitionUnsupportedRequirement[] = [];
	const markUnsupported = (
		when: WhenSchema.Type,
		reason: EditorAcquisitionUnsupportedRequirement["reason"],
	) =>
		unsupported.push({
			factId: when.query.selector.itemId,
			reason,
			source,
		});
	for (const rule of rules) {
		if (rule.type === "enable") {
			for (const when of rule.when) {
				const quantity = readSatisfyQuantity(when);
				if (quantity !== undefined && quantity > 0)
					allOf.push(makeRequirement(when, quantity, source));
				if (when.type === "count") markUnsupported(when, "exact-count");
				if (when.type === "range") markUnsupported(when, "upper-bound");
			}
			continue;
		}
		if (rule.type !== "disable") continue;
		const alternatives: EditorAcquisitionRequirement[] = [];
		let factFree = false;
		for (const when of rule.when) {
			const quantity = readFalsifyQuantity(when);
			if (quantity === undefined) {
				markUnsupported(when, "negative-condition");
				factFree = true;
				break;
			}
			alternatives.push(makeRequirement(when, quantity, source));
		}
		if (!factFree && alternatives.length > 0) anyOf.push(alternatives);
	}
	const compare = (left: EditorAcquisitionRequirement, right: EditorAcquisitionRequirement) =>
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
