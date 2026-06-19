import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { createGameItemInstanceIdFx } from "~/v0/game/save/createGameItemInstanceIdFx";
import { findFirstEmptyBoardCellFx } from "~/v0/game/placement/findFirstEmptyBoardCellFx";
import { placeGameSaveInventoryRemainderFx } from "~/v0/game/placement/placeGameSaveInventoryRemainderFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export type GameSaveSingleItemPlacementResult = {
	type: "placed";
};

export namespace placeSingleGameSaveItemRequestFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		item: GameSaveItemPlacementRequest;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const placeSingleGameSaveItemRequestFx = Effect.fn("placeSingleGameSaveItemRequestFx")(
	function* ({ config, events, item, save, seedCell }: placeSingleGameSaveItemRequestFx.Props) {
		const itemDefinition = config.items[item.itemId];

		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
			);
		}

		let remainingQuantity = item.quantity;
		let boardPlacedQuantity = 0;
		let boardRanOutOfSpace = false;

		while (remainingQuantity > 0) {
			const emptyCell = yield* findFirstEmptyBoardCellFx({
				config,
				save,
				seedCell,
			});

			if (!emptyCell) {
				boardRanOutOfSpace = true;
				break;
			}

			const itemInstanceId = yield* createGameItemInstanceIdFx();
			save.board.items[itemInstanceId] = {
				id: itemInstanceId,
				itemId: item.itemId,
				x: emptyCell.x,
				y: emptyCell.y,
			};
			events.push({
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				reason: item.reason,
				to: {
					kind: "board",
					itemInstanceId,
					x: emptyCell.x,
					y: emptyCell.y,
				},
				type: "item.created",
			});
			remainingQuantity -= 1;
			boardPlacedQuantity += 1;
		}

		const inventoryPlaced = yield* placeGameSaveInventoryRemainderFx({
			events,
			item,
			maxStackSize: itemDefinition.maxStackSize,
			remainingQuantity,
			slots: save.inventory.slots,
		});

		if (inventoryPlaced) {
			return {
				type: "placed",
			} satisfies GameSaveSingleItemPlacementResult;
		}

		const reason =
			boardRanOutOfSpace && boardPlacedQuantity === 0 ? "board:full" : "inventory:full";

		return yield* Effect.fail(
			GameEngineError.placementFailed(reason, "Placement target is full."),
		);
	},
);
