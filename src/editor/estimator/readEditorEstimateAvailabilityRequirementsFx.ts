import { Effect } from "effect";

import type { EditorEstimateRequirement } from "~/editor/estimator/EditorEstimateDependencyGraph";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export namespace readEditorEstimateAvailabilityRequirementsFx {
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
): EditorEstimateRequirement => ({
	factId: when.query.selector.itemId,
	quantity,
	source,
	usage: "ongoing",
});

/** Projects authored enable/disable conditions into positive static facts. */
export const readEditorEstimateAvailabilityRequirementsFx = Effect.fn(
	"readEditorEstimateAvailabilityRequirementsFx",
)(({ rules, source }: readEditorEstimateAvailabilityRequirementsFx.Props) =>
	Effect.sync(() => {
		const allOf: EditorEstimateRequirement[] = [];
		const anyOf: EditorEstimateRequirement[][] = [];
		for (const rule of rules) {
			if (rule.type === "enable") {
				for (const when of rule.when) {
					const quantity = readSatisfyQuantity(when);
					if (quantity > 0) allOf.push(makeRequirement(when, quantity, source));
				}
				continue;
			}
			if (rule.type !== "disable") continue;
			const alternatives: EditorEstimateRequirement[] = [];
			let factFree = false;
			for (const when of rule.when) {
				const quantity = readFalsifyQuantity(when);
				if (quantity === undefined) {
					factFree = true;
					break;
				}
				alternatives.push(makeRequirement(when, quantity, source));
			}
			if (!factFree && alternatives.length > 0) anyOf.push(alternatives);
		}
		const compare = (left: EditorEstimateRequirement, right: EditorEstimateRequirement) =>
			left.factId.localeCompare(right.factId) || left.quantity - right.quantity;
		return {
			allOf: allOf.sort(compare),
			anyOf: anyOf.map((clause) => clause.sort(compare)),
		};
	}),
);
