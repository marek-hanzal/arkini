import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";

export namespace readDropMaximumQuantitiesFn {
	export interface Props {
		drop: readonly DropSchema.Type[];
	}
}

/** Sums the largest possible quantity of each canonical item across one emitted drop group. */
export const readDropMaximumQuantitiesFn = ({ drop }: readDropMaximumQuantitiesFn.Props) => {
	const quantities = new Map<IdSchema.Type, number>();

	for (const candidate of drop) {
		const quantity = candidate.quantity.max;
		quantities.set(candidate.itemId, (quantities.get(candidate.itemId) ?? 0) + quantity);
	}

	return quantities;
};
