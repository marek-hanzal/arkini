import { Effect } from "effect";
import { repeatActivationItem } from "~/activation/logic/repeatActivationItem";
import type { ItemId } from "~/manifest/manifestId";
import type { ActivationOutput } from "~/manifest/producer";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { resolveActivationQuantityFx } from "./resolveActivationQuantityFx";
import { rollWeightedActivationDropsFx } from "./rollWeightedActivationDropsFx";

export namespace rollActivationOutputFx {
	export interface Props {
		outputs: readonly ActivationOutput[];
	}
}

export const rollActivationOutputFx = Effect.fn("rollActivationOutputFx")(function* ({
	outputs,
}: rollActivationOutputFx.Props) {
	const drops: ItemId[] = [];
	const random = yield* RandomServiceFx;

	for (const output of outputs) {
		switch (output.type) {
			case "guaranteed": {
				const quantity = yield* resolveActivationQuantityFx({
					quantity: output.quantity ?? 1,
				});
				drops.push(...repeatActivationItem(output.itemId, quantity));
				break;
			}
			case "chance": {
				if (!random.chance(output.probability)) break;
				const quantity = yield* resolveActivationQuantityFx({
					quantity: output.quantity ?? 1,
				});
				drops.push(...repeatActivationItem(output.itemId, quantity));
				break;
			}
			case "weighted": {
				const rolls = yield* resolveActivationQuantityFx({
					quantity: output.rolls ?? 1,
				});
				drops.push(
					...(yield* rollWeightedActivationDropsFx({
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
