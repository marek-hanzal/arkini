import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import {
	cloneInventory,
	planExactInventorySlotPlacement,
	planInventoryPlacement,
} from "~/inventory/logic/planning";
import { normalizeInventoryStateJson } from "~/inventory/logic/inventoryState";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { applyInventoryPlacementPlanFx } from "~/play/fx/applyInventoryPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { StashBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

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

	yield* withTransactionFx(
		Effect.gen(function* () {
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			const boardItem = boardRows.find((row) => row.id === input.boardItemId);
			if (!boardItem) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const options = {
				gameConfig,
				id,
				stateJson: normalizeInventoryStateJson(boardItem.stateJson),
			};
			const virtualInventory = cloneInventory(inventoryRows);
			const plan =
				input.slotIndex === undefined
					? planInventoryPlacement(
							save,
							virtualInventory,
							boardItem.itemDefinitionId,
							options,
						)
					: planExactInventorySlotPlacement(
							save,
							virtualInventory,
							boardItem.itemDefinitionId,
							input.slotIndex,
							options,
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
				plan,
			});
			yield* dbFx((db) =>
				db.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute(),
			);
		}),
	);
});
