import { Effect } from "effect";
import { match } from "ts-pattern";
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
		yield* match(output)
			.with(
				{
					type: "guaranteed",
				},
				(output) =>
					Effect.gen(function* () {
						const quantity = yield* resolveActivationQuantityFx({
							quantity: output.quantity ?? 1,
						});
						drops.push(...repeatActivationItem(output.itemId, quantity));
					}),
			)
			.with(
				{
					type: "chance",
				},
				(output) =>
					Effect.gen(function* () {
						if (!random.chance(output.probability)) return;
						const quantity = yield* resolveActivationQuantityFx({
							quantity: output.quantity ?? 1,
						});
						drops.push(...repeatActivationItem(output.itemId, quantity));
					}),
			)
			.with(
				{
					type: "weighted",
				},
				(output) =>
					Effect.gen(function* () {
						const rolls = yield* resolveActivationQuantityFx({
							quantity: output.rolls ?? 1,
						});
						drops.push(
							...(yield* rollWeightedActivationDropsFx({
								entries: output.entries,
								rolls,
							})),
						);
					}),
			)
			.exhaustive();
	}

	return drops;
});
