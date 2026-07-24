import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { projectItemDetailInputFx } from "~/bridge/item-detail/projectItemDetailInputFx";
import { projectItemDetailOutputRollFx } from "~/bridge/item-detail/projectItemDetailOutputRollFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace projectItemDetailLinesFx {
	export interface Props {
		readonly game: GameEngine;
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result = ItemDetailLines.Projection;
}

/** Projects all current line facts and action readiness for one exact Item Detail owner. */
export const projectItemDetailLinesFx = Effect.fn("projectItemDetailLinesFx")(function* ({
	game,
	itemId,
	runtime,
}: projectItemDetailLinesFx.Props) {
	const lines = yield* readItemDetailLinesFx({
		itemId,
		runtime,
	});
	if (lines.kind === "unavailable") {
		return {
			kind: "unavailable",
		} satisfies projectItemDetailLinesFx.Result;
	}
	return {
		kind: "available",
		itemId: lines.itemId,
		line: yield* Effect.all(
			lines.line.map((line) =>
				Effect.all({
					input: Effect.all(
						line.input.map((input) =>
							projectItemDetailInputFx({
								game,
								input,
								runtime,
							}),
						),
					),
					output: Effect.all(
						line.output.map((set) =>
							Effect.all(
								set.roll.map((roll) =>
									projectItemDetailOutputRollFx({
										game,
										roll,
									}),
								),
							).pipe(
								Effect.map((roll) => ({
									weight: set.weight,
									roll,
								})),
							),
						),
					),
				}).pipe(
					Effect.map(({ input, output }) => ({
						...line,
						input,
						output,
					})),
				),
			),
		),
	} satisfies projectItemDetailLinesFx.Result;
});
