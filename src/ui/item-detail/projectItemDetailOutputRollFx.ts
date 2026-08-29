import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { projectItemDetailOutputItemFx } from "~/ui/item-detail/projectItemDetailOutputItemFx";
import type { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";

export namespace projectItemDetailOutputRollFx {
	export interface Props {
		readonly game: GameEngine;
		readonly roll: readItemDetailLinesFx.OutputRoll;
	}
}

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
						projectItemDetailOutputItemFx({
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
						projectItemDetailOutputItemFx({
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
								projectItemDetailOutputItemFx({
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
