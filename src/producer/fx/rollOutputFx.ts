import { Effect } from "effect";
import type { ItemId } from "~/manifest/data/manifestId";
import { repeatItem } from "~/producer/logic/repeatItem";
import type { ProducerOutput } from "~/manifest/data/producer";
import { resolveQuantityFx } from "./resolveQuantityFx";
import { rollWeightedDropsFx } from "./rollWeightedDropsFx";

export namespace rollOutputFx {
	export interface Props {
		outputs: readonly ProducerOutput[];
	}
}

export const rollOutputFx = Effect.fn("rollOutputFx")(function* ({ outputs }: rollOutputFx.Props) {
	const drops: ItemId[] = [];

	for (const output of outputs) {
		switch (output.type) {
			case "guaranteed": {
				const quantity = yield* resolveQuantityFx({
					quantity: output.quantity ?? 1,
				});
				drops.push(...repeatItem(output.itemId, quantity));
				break;
			}
			case "chance": {
				if (Math.random() > output.probability) break;
				const quantity = yield* resolveQuantityFx({
					quantity: output.quantity ?? 1,
				});
				drops.push(...repeatItem(output.itemId, quantity));
				break;
			}
			case "weighted": {
				const rolls = yield* resolveQuantityFx({
					quantity: output.rolls ?? 1,
				});
				drops.push(
					...(yield* rollWeightedDropsFx({
						entries: output.entries,
						rolls,
					})),
				);
				break;
			}
		}
	}

	return drops;
});
