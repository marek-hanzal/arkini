import { Effect } from "effect";
import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import {
	type ItemDetailOutputRuleContext,
	readItemDetailOutputItemsFx,
} from "~/engine/item-detail/read/readItemDetailOutputItemsFx";
import { TypeSchema } from "~/engine/roll/schema/TypeSchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";

/** Projects one exact authored output roll without flattening its probability semantics. */
export const readItemDetailOutputRollFx = Effect.fn("readItemDetailOutputRollFx")(function* ({
	roll,
	ruleContext,
}: {
	readonly roll: RollSchema.Type;
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	return yield* match(roll)
		.with(
			{
				type: TypeSchema.enum.Guaranteed,
			},
			({ drop }) =>
				Effect.gen(function* () {
					return {
						kind: "guaranteed",
						item: yield* readItemDetailOutputItemsFx({
							drops: drop,
							ruleContext,
						}),
					} satisfies ItemDetailLines.OutputRoll;
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Chance,
			},
			({ chance, drop }) =>
				Effect.gen(function* () {
					return {
						kind: "chance",
						chance,
						item: yield* readItemDetailOutputItemsFx({
							drops: drop,
							ruleContext,
						}),
					} satisfies ItemDetailLines.OutputRoll;
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Weight,
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
							item: yield* readItemDetailOutputItemsFx({
								drops: candidate.drop,
								ruleContext,
							}),
						});
					}
					return {
						kind: "weight",
						selections: quantity,
						option,
					} satisfies ItemDetailLines.OutputRoll;
				}),
		)
		.exhaustive();
});
