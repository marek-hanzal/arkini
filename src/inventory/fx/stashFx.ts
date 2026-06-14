import { Effect } from "effect";
import { pauseCraftTimer } from "~/board/logic/pauseCraftTimer";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { cloneInventory } from "~/inventory/logic/planning/cloneInventory";
import { planExactInventorySlotPlacement } from "~/inventory/logic/planning/planExactInventorySlotPlacement";
import { planInventoryPlacement } from "~/inventory/logic/planning/planInventoryPlacement";
import { normalizeInventoryStateJson } from "~/inventory/logic/normalizeInventoryStateJson";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { applyInventoryPlacementPlanFx } from "~/play/fx/applyInventoryPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { StashBoardItemInputSchema } from "~/play/schema/StashBoardItemInputSchema";
import type { BoardItemState } from "~/play/logic/playTypes";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { json } from "~/shared/json";
import { parseJson } from "~/shared/parseJson";

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
			const date = yield* DateServiceFx;
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			const boardItem = boardRows.find((row) => row.id === input.boardItemId);
			if (!boardItem) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const pausedState = pauseCraftTimer(
				parseJson<BoardItemState>(boardItem.stateJson || "{}"),
				date,
			);
			const stateJson = normalizeInventoryStateJson(json(pausedState));
			const options = {
				gameConfig,
				id,
				stateJson,
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
