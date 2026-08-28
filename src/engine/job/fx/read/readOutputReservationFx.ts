import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import { ModeSchema } from "~/engine/input/schema/ModeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";

/** Reads one line's worst-case output reservation after guaranteed exact-item consumption. */
export const readOutputReservationFx = Effect.fn("readOutputReservationFx")(function* (
	line: LineSchema.Type,
) {
	const quantities =
		line.output === undefined
			? new Map<IdSchema.Type, number>()
			: new Map(
					yield* readOutputMaximumQuantitiesFx({
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
});
