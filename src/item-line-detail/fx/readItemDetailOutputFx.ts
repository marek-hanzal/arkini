import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemDetailLines } from "~/item-line-detail/type/ItemDetailLines";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { dropRulesFx } from "~/production-output/fx/dropRulesFx";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { RollTypeSchema } from "~/production-output/schema/RollTypeSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";
import type { LineSchema } from "~/production-line/schema/LineSchema";

interface ItemDetailOutputRuleContext {
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const readItemDetailOutputItemsFx = Effect.fn("readItemDetailOutputItemsFx")(function* ({
	drops,
	ruleContext,
}: {
	readonly drops: readonly DropSchema.Type[];
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	const grouped = new Map<IdSchema.Type, ItemDetailLines.OutputItem>();
	for (const drop of drops) {
		const activeRuleHints =
			ruleContext === undefined
				? []
				: yield* dropRulesFx({
						origin: ruleContext.origin,
						rules: drop.rules,
					}).pipe(
						Effect.provideService(RuntimeFx, {
							read: Effect.succeed(ruleContext.runtime),
						}),
						Effect.map((results) =>
							results.flatMap((result, ruleIndex) => {
								const hint = drop.rules[ruleIndex]?.hint;
								return result.active && hint !== undefined
									? [
											hint,
										]
									: [];
							}),
						),
					);
		const previous = grouped.get(drop.itemId);
		grouped.set(drop.itemId, {
			itemId: drop.itemId,
			quantity: {
				min: (previous?.quantity.min ?? 0) + drop.quantity.min,
				max: (previous?.quantity.max ?? 0) + drop.quantity.max,
			},
			activeRuleHints: [
				...new Set([
					...(previous?.activeRuleHints ?? []),
					...activeRuleHints,
				]),
			],
		});
	}
	return [
		...grouped.values(),
	];
});

const readItemDetailOutputRollFx = Effect.fn("readItemDetailOutputRollFx")(function* ({
	roll,
	ruleContext,
}: {
	readonly roll: RollSchema.Type;
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	return yield* match(roll)
		.with(
			{
				type: RollTypeSchema.enum.Guaranteed,
			},
			({ drop }) =>
				Effect.gen(function* () {
					return {
						kind: "guaranteed",
						item: yield* readItemDetailOutputItemsFx({
							drops: drop,
							ruleContext,
						}),
					} satisfies OutputProjection.Roll<ItemDetailLines.OutputItem>;
				}),
		)
		.with(
			{
				type: RollTypeSchema.enum.Chance,
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
					} satisfies OutputProjection.Roll<ItemDetailLines.OutputItem>;
				}),
		)
		.with(
			{
				type: RollTypeSchema.enum.Weight,
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
					} satisfies OutputProjection.Roll<ItemDetailLines.OutputItem>;
				}),
		)
		.exhaustive();
});

/** Projects one line's authored output sets without flattening roll or probability semantics. */
export const readItemDetailOutputFx = Effect.fn("readItemDetailOutputFx")(function* ({
	line,
	ruleContext,
}: {
	readonly line: LineSchema.Type;
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	const output: OutputProjection.Set<ItemDetailLines.OutputItem>[] = [];
	for (const set of line.output?.set ?? []) {
		const roll: OutputProjection.Roll<ItemDetailLines.OutputItem>[] = [];
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
