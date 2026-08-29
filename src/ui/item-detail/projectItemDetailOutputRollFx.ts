import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { readRuntimeItemDefaultAssetIdsFx } from "~/engine/item/read/readRuntimeItemDefaultAssetIdsFx";
import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";
import type { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";

export namespace projectItemDetailOutputRollFx {
	export interface Props {
		readonly game: GameEngine;
		readonly roll: readItemDetailLinesFx.OutputRoll;
	}
}

const projectOutputItemFx = Effect.fn("projectItemDetailOutputRollFx.projectItemFx")(function* ({
	game,
	item,
}: {
	readonly game: GameEngine;
	readonly item: readItemDetailLinesFx.OutputItem;
}) {
	const configured = game.config.items[item.itemId];
	if (configured === undefined) {
		return {
			itemId: item.itemId,
			title: item.itemId,
			quantity: item.quantity,
			activeRuleHints: item.activeRuleHints,
		} satisfies ItemDetailLines.OutputItem;
	}
	const sourceAssetIds = yield* readRuntimeItemDefaultAssetIdsFx({
		item: configured,
	});
	return {
		itemId: item.itemId,
		title: configured.title,
		quantity: item.quantity,
		activeRuleHints: item.activeRuleHints,
		sourceUrl: game.getResourceUrl(sourceAssetIds[0]),
		...(sourceAssetIds[1] === undefined
			? {}
			: {
					compositeUrl: game.getResourceUrl(sourceAssetIds[1]),
				}),
		definitionItemId: configured.id,
	} satisfies ItemDetailLines.OutputItem;
});

/** Projects one engine-owned output roll while preserving its authored roll semantics. */
export const projectItemDetailOutputRollFx = Effect.fn("projectItemDetailOutputRollFx")(function* ({
	game,
	roll,
}: projectItemDetailOutputRollFx.Props) {
	return yield* match(roll)
		.with(
			{
				kind: "guaranteed",
			},
			(guaranteed) =>
				Effect.all(
					guaranteed.item.map((item) =>
						projectOutputItemFx({
							game,
							item,
						}),
					),
				).pipe(
					Effect.map((item) => ({
						kind: "guaranteed" as const,
						item,
					})),
				),
		)
		.with(
			{
				kind: "chance",
			},
			(chance) =>
				Effect.all(
					chance.item.map((item) =>
						projectOutputItemFx({
							game,
							item,
						}),
					),
				).pipe(
					Effect.map((item) => ({
						kind: "chance" as const,
						chance: chance.chance,
						item,
					})),
				),
		)
		.with(
			{
				kind: "weight",
			},
			(weight) =>
				Effect.all(
					weight.option.map((option) =>
						Effect.all(
							option.item.map((item) =>
								projectOutputItemFx({
									game,
									item,
								}),
							),
						).pipe(
							Effect.map((item) => ({
								weight: option.weight,
								item,
							})),
						),
					),
				).pipe(
					Effect.map((option) => ({
						kind: "weight" as const,
						selections: weight.selections,
						option,
					})),
				),
		)
		.exhaustive();
});
