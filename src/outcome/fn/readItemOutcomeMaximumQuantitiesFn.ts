import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

export namespace readItemOutcomeMaximumQuantitiesFn {
	export interface Props {
		outcome: readonly OutcomeSchema.Type[];
	}
}

/** Sums the largest possible quantity of each canonical item across one emitted outcome group. */
export const readItemOutcomeMaximumQuantitiesFn = ({
	outcome,
}: readItemOutcomeMaximumQuantitiesFn.Props) => {
	const quantities = new Map<IdSchema.Type, number>();

	for (const candidate of outcome) {
		if (candidate.type !== "item") continue;
		const quantity = candidate.quantity.max;
		quantities.set(candidate.itemId, (quantities.get(candidate.itemId) ?? 0) + quantity);
	}

	return quantities;
};
