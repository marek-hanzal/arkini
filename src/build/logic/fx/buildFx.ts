import { Effect } from "effect";
import { assertInsideBoard } from "~/board/logic/gameBounds";
import { insertFx } from "~/board/logic/fx/insertFx";
import { db } from "~/database/local/db";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import type { BuildRecipeId } from "~/manifest/data/manifestId";
import { removeItemsFx } from "~/inventory/logic/fx/removeItemsFx";
import { canPayCosts } from "~/play/logic/canPayCosts";
import { BuildRecipeInputSchema } from "~/play/logic/gameActionSchemas";
import { readMutableSaveFx } from "~/play/logic/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/fx/toGameActionError";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { GameActionError } from "~/play/logic/playTypes";

export namespace buildFx {
	export interface Props {
		recipeId: string;
		x: number;
		y: number;
	}
}

export const buildFx = Effect.fn("buildFx")(function* (props: buildFx.Props) {
	const input = yield* Effect.try({
		try: () => BuildRecipeInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* tryGameActionFx(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const { save, boardRows, inventoryRows } = yield* readMutableSaveFx({
						tx,
					});
					assertInsideBoard(save, input.x, input.y);
					if (boardRows.some((row) => row.x === input.x && row.y === input.y)) {
						return yield* Effect.fail(new GameActionError("Build target is occupied."));
					}

					const recipe = gameDataIndex.buildRecipesById.get(
						input.recipeId as BuildRecipeId,
					);
					if (!recipe)
						return yield* Effect.fail(new GameActionError("Unknown build recipe."));

					const costs = [
						{
							itemId: recipe.blueprintItemId,
							quantity: 1,
						},
						...recipe.costs,
					];
					const inventory = inventoryRows.map((row) => ({
						slotIndex: row.slotIndex,
						stack: {
							id: row.id,
							itemId: row.itemDefinitionId,
							quantity: row.quantity,
						},
					}));
					if (!canPayCosts(inventory, costs)) {
						return yield* Effect.fail(
							new GameActionError("Inventory is missing blueprint or materials."),
						);
					}

					for (const cost of costs) {
						yield* removeItemsFx({
							tx,
							itemId: cost.itemId,
							quantity: cost.quantity,
						});
					}

					yield* insertFx({
						tx,
						itemId: recipe.resultItemId,
						x: input.x,
						y: input.y,
					});
				}),
			),
		),
	);
});
