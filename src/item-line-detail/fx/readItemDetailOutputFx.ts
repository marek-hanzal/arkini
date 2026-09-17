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
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";
import type { LineSchema } from "~/production-line/schema/LineSchema";

interface ItemDetailOutputRuleContext {
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const readActiveRuleHintsFx = Effect.fn("readActiveOutputRuleHintsFx")(function* ({
	rules,
	ruleContext,
}: {
	readonly rules: readonly DropRuleSchema.Type[];
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	if (ruleContext === undefined) return [];
	return yield* dropRulesFx({
		origin: ruleContext.origin,
		rules,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(ruleContext.runtime),
		}),
		Effect.map((results) =>
			results.flatMap((result, ruleIndex) => {
				const hint = rules[ruleIndex]?.hint;
				return result.type === "disable" && result.active && hint !== undefined
					? [
							hint,
						]
					: [];
			}),
		),
	);
});

const readItemDetailOutputItemsFx = Effect.fn("readItemDetailOutputItemsFx")(function* ({
	drops,
	ruleContext,
}: {
	readonly drops: readonly DropSchema.Type[];
	readonly ruleContext?: ItemDetailOutputRuleContext;
}) {
	const grouped = new Map<IdSchema.Type, ItemDetailLines.OutputItem>();
	for (const drop of drops) {
		const activeRuleHints = yield* readActiveRuleHintsFx({
			rules: drop.rules,
			ruleContext,
		});
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
			activeRuleHints: yield* readActiveRuleHintsFx({
				rules: set.rules,
				ruleContext,
			}),
			weight: set.weight,
			roll,
		});
	}
	return output;
});
