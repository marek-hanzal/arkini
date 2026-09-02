import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { readRollMaximumQuantitiesFn } from "~/production-output/fn/readRollMaximumQuantitiesFn";

export namespace readOutputMaximumQuantitiesFn {
	export interface Props {
		output: OutputSchema.Type;
	}
}

/** Reads the per-item worst-case quantity across every alternative output roll set. */
export const readOutputMaximumQuantitiesFn = ({ output }: readOutputMaximumQuantitiesFn.Props) => {
	const quantities = new Map<IdSchema.Type, number>();

	for (const set of output.set) {
		const setQuantities = new Map<IdSchema.Type, number>();
		for (const roll of set.roll) {
			const rollQuantities = readRollMaximumQuantitiesFn({
				roll,
			});
			for (const [itemId, quantity] of rollQuantities) {
				setQuantities.set(itemId, (setQuantities.get(itemId) ?? 0) + quantity);
			}
		}

		for (const [itemId, quantity] of setQuantities) {
			quantities.set(itemId, Math.max(quantities.get(itemId) ?? 0, quantity));
		}
	}

	return quantities;
};
