import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { readRollMaximumQuantitiesFx } from "~/engine/roll/fx/readRollMaximumQuantitiesFx";

export namespace readOutputMaximumQuantitiesFx {
	export interface Props {
		output: OutputSchema.Type;
	}
}

/** Reads the per-item worst-case quantity across every alternative output roll set. */
export const readOutputMaximumQuantitiesFx = Effect.fn("readOutputMaximumQuantitiesFx")(function* ({
	output,
}: readOutputMaximumQuantitiesFx.Props) {
	const quantities = new Map<IdSchema.Type, number>();

	for (const set of output.set) {
		const setQuantities = new Map<IdSchema.Type, number>();
		for (const roll of set.roll) {
			const rollQuantities = yield* readRollMaximumQuantitiesFx({
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
});
