import { Effect } from "effect";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import type { ItemDetailOutputRuleContext } from "~/engine/item-detail/read/readItemDetailOutputItemsFx";
import { readItemDetailOutputRollFx } from "~/engine/item-detail/read/readItemDetailOutputRollFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

/** Projects one line's authored output sets while preserving set and roll boundaries. */
export const readItemDetailOutputFx = Effect.fn("readItemDetailOutputFx")(function* ({
	line,
	ruleContext,
}: {
	readonly line: LineSchema.Type;
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	const output: ItemDetailLines.OutputSet[] = [];
	for (const set of line.output?.set ?? []) {
		const roll: ItemDetailLines.OutputRoll[] = [];
		for (const configuredRoll of set.roll) {
			roll.push(
				yield* readItemDetailOutputRollFx({
					roll: configuredRoll,
					ruleContext,
				}),
			);
		}
		output.push({
			weight: set.weight,
			roll,
		});
	}
	return output;
});
