import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";

/** Reads one line's worst-case output reservation after guaranteed exact-item consumption. */
export const readOutputReservationFn = (line: LineSchema.Type) => {
	const quantities =
		line.output === undefined
			? new Map<IdSchema.Type, number>()
			: new Map(
					readOutputMaximumQuantitiesFn({
						output: line.output,
					}),
				);
	for (const input of line.input) {
		if (input.type !== TypeSchema.enum.Materials || input.mode !== ModeSchema.enum.Consume) {
			continue;
		}
		const reservedQuantity = Math.max(
			0,
			(quantities.get(input.selector.itemId) ?? 0) - input.quantity.min,
		);
		if (reservedQuantity === 0) quantities.delete(input.selector.itemId);
		else quantities.set(input.selector.itemId, reservedQuantity);
	}
	return quantities;
};
