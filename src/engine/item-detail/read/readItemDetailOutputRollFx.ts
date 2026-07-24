import { Effect } from "effect";
import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailOutputItemsFx } from "~/engine/item-detail/read/readItemDetailOutputItemsFx";
import { readItemDetailQuantityBoundsFx } from "~/engine/item-detail/read/readItemDetailQuantityBoundsFx";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";

/** Projects one exact authored output roll without flattening its probability semantics. */
export const readItemDetailOutputRollFx = Effect.fn("readItemDetailOutputRollFx")(function* (
	roll: RollSchema.Type,
) {
	return yield* match(roll)
		.with(
			{
				type: RollEnumSchema.enum.Guaranteed,
			},
			({ drop }) =>
				Effect.gen(function* () {
					return {
						kind: "guaranteed",
						item: yield* readItemDetailOutputItemsFx(drop),
					} satisfies ItemDetailLines.OutputRoll;
				}),
		)
		.with(
			{
				type: RollEnumSchema.enum.Chance,
			},
			({ chance, drop }) =>
				Effect.gen(function* () {
					return {
						kind: "chance",
						chance,
						item: yield* readItemDetailOutputItemsFx(drop),
					} satisfies ItemDetailLines.OutputRoll;
				}),
		)
		.with(
			{
				type: RollEnumSchema.enum.Weight,
			},
			({ quantity, drop }) =>
				Effect.gen(function* () {
					const option: {
						readonly weight: number;
						readonly item: readonly ItemDetailLines.OutputItem[];
					}[] = [];
					for (const candidate of drop) {
						option.push({
							weight: candidate.weight,
							item: yield* readItemDetailOutputItemsFx(candidate.drop),
						});
					}
					return {
						kind: "weight",
						selections: yield* readItemDetailQuantityBoundsFx(quantity),
						option,
					} satisfies ItemDetailLines.OutputRoll;
				}),
		)
		.exhaustive();
});
