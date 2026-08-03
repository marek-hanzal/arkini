import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";

/** Reads conservative net authored output after guaranteed exact-item consumption. */
export const readLineNetMaximumOutputQuantitiesFx = Effect.fn(
	"readLineNetMaximumOutputQuantitiesFx",
)(function* (line: LineSchema.Type) {
	const quantities =
		line.output === undefined
			? new Map<IdSchema.Type, number>()
			: new Map(
					yield* readOutputMaximumQuantitiesFx({
						output: line.output,
					}),
				);
	for (const input of line.input) {
		if (
			input.type !== InputEnumSchema.enum.Materials ||
			input.mode !== InputModeEnumSchema.enum.Consume
		) {
			continue;
		}
		const netQuantity = Math.max(
			0,
			(quantities.get(input.selector.itemId) ?? 0) - input.quantity.min,
		);
		if (netQuantity === 0) quantities.delete(input.selector.itemId);
		else quantities.set(input.selector.itemId, netQuantity);
	}
	return quantities;
});
