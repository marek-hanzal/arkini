import { Effect } from "effect";
import { insertFx } from "~/board/fx/insertFx";
import { assertInsideBoard } from "~/board/logic/gameBounds";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { removeItemsFx } from "~/inventory/fx/removeItemsFx";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import type { BuildRecipeId } from "~/manifest/data/manifestId";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { canPayCosts } from "~/play/logic/canPayCosts";
import { BuildRecipeInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

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

	yield* withTransactionFx(
		Effect.gen(function* () {
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			assertInsideBoard(save, input.x, input.y);
			if (boardRows.some((row) => row.x === input.x && row.y === input.y)) {
				return yield* Effect.fail(new GameActionError("Build target is occupied."));
			}

			const recipe = gameDataIndex.buildRecipesById.get(input.recipeId as BuildRecipeId);
			if (!recipe) {
				return yield* Effect.fail(new GameActionError("Unknown build recipe."));
			}

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
					itemId: cost.itemId,
					quantity: cost.quantity,
				});
			}

			yield* insertFx({
				itemId: recipe.resultItemId,
				x: input.x,
				y: input.y,
			});
		}),
	);
});
