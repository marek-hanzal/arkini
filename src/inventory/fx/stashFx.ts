import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import {
	cloneInventory,
	planExactInventorySlotPlacement,
	planInventoryPlacement,
} from "~/inventory/logic/planning";
import { applyInventoryPlacementPlanFx } from "~/play/fx/applyInventoryPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { tryGameAction } from "~/play/logic/tryGameAction";
import { StashBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import type { ItemId } from "~/manifest/data/manifestId";

export namespace stashFx {
	export interface Props {
		boardItemId: string;
		slotIndex?: number;
	}
}

export const stashFx = Effect.fn("stashFx")(function* (props: stashFx.Props) {
	const input = yield* Effect.try({
		try: () => StashBoardItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* tryGameAction(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const { save, boardRows, inventoryRows } = yield* readMutableSaveFx({
						tx,
					});
					const boardItem = boardRows.find((row) => row.id === input.boardItemId);
					if (!boardItem)
						return yield* Effect.fail(
							new GameActionError("Board item does not exist."),
						);
					if (gameDataIndex.producersByItemId.has(boardItem.itemDefinitionId as ItemId)) {
						return yield* Effect.fail(
							new GameActionError(
								"Producer lives on the board. Pause it instead of hiding its state in inventory.",
							),
						);
					}

					const virtualInventory = cloneInventory(inventoryRows);
					const plan =
						input.slotIndex === undefined
							? planInventoryPlacement(
									save,
									virtualInventory,
									boardItem.itemDefinitionId as ItemId,
								)
							: planExactInventorySlotPlacement(
									save,
									virtualInventory,
									boardItem.itemDefinitionId as ItemId,
									input.slotIndex,
								);
					if (!plan) {
						return yield* Effect.fail(
							new GameActionError(
								input.slotIndex === undefined
									? "Inventory is full."
									: "Inventory slot cannot accept this item.",
							),
						);
					}

					yield* applyInventoryPlacementPlanFx({
						tx,
						plan,
					});
					yield* tryGameAction(() =>
						tx.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute(),
					);
				}),
			),
		),
	);
});
