import { Effect } from "effect";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailOutputRollFx } from "~/engine/item-detail/read/readItemDetailOutputRollFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

/** Projects one line's authored output sets while preserving set and roll boundaries. */
export const readItemDetailOutputFx = Effect.fn("readItemDetailOutputFx")(function* (
	line: LineSchema.Type,
) {
	const output: ItemDetailLines.OutputSet[] = [];
	for (const set of line.output?.set ?? []) {
		const roll: ItemDetailLines.OutputRoll[] = [];
		for (const configuredRoll of set.roll) {
			roll.push(yield* readItemDetailOutputRollFx(configuredRoll));
		}
		output.push({
			weight: set.weight ?? 1,
			roll,
		});
	}
	return output;
});
