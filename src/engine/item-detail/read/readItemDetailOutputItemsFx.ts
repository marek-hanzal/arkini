import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { dropRulesFx } from "~/engine/output/fx/dropRulesFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface ItemDetailOutputRuleContext {
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

/** Aggregates duplicate drops inside one exact output-roll branch. */
export const readItemDetailOutputItemsFx = Effect.fn("readItemDetailOutputItemsFx")(function* ({
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
