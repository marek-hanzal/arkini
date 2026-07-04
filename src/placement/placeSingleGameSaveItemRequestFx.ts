import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/engine/model/GameSaveSchema";

type GameSaveSingleItemPlacementResult = {
	type: "placed";
};

export namespace placeSingleGameSaveItemRequestFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		freedBoardItemInstanceIds?: ReadonlySet<string>;
		item: GameSaveItemPlacementRequest;
		nowMs: number;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const placeSingleGameSaveItemRequestFx = Effect.fn("placeSingleGameSaveItemRequestFx")(
	function* ({
		config,
		events,
		freedBoardItemInstanceIds,
		item,
		nowMs,
		save,
		seedCell,
	}: placeSingleGameSaveItemRequestFx.Props) {
		const itemDefinition = config.items[item.itemId];

		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
			);
		}

		const createdAtMs =
			item.createdAtMs ?? (itemDefinition.effects?.length ? nowMs : undefined);
		let remainingQuantity = item.quantity;
		let boardPlacedQuantity = 0;
		let boardHitMaxCount = false;
		let boardRanOutOfSpace = false;
		const canPlaceOnBoard = isItemStorageAllowed({
			config,
			itemId: item.itemId,
			location: "board",
		});
		const canPlaceInInventory = isItemStorageAllowed({
			config,
			itemId: item.itemId,
			location: "inventory",
		});

		while (canPlaceOnBoard && remainingQuantity > 0) {
			if (
				(yield* readBoardItemMaxCountCapacityFx({
					config,
					ignoredBoardItemInstanceIds: freedBoardItemInstanceIds,
					itemId: item.itemId,
					save,
				})) <= 0
			) {
				boardHitMaxCount = true;
				break;
			}

			const emptyCells = yield* planEmptyBoardCellsFx({
				config,
				freedBoardItemInstanceIds,
				save,
				seedCell,
			});
			if (emptyCells.length === 0) {
				boardRanOutOfSpace = true;
				break;
			}

			const [emptyCell] = yield* planItemBoardPlacementCellsFx({
				config,
				freedBoardItemInstanceIds,
				itemId: item.itemId,
				nowMs,
				save,
				seedCell,
			});
			if (!emptyCell) {
				boardRanOutOfSpace = true;
				break;
			}

			const itemInstanceId = yield* createGameItemInstanceIdFx();
			save.board.items[itemInstanceId] = {
				...(createdAtMs !== undefined
					? {
							createdAtMs,
						}
					: {}),
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

		const inventoryPlaced = canPlaceInInventory
			? yield* placeGameSaveInventoryRemainderFx({
					createdAtMs,
					events,
					item,
					maxStackSize: itemDefinition.maxStackSize,
					remainingQuantity,
					slots: save.inventory.slots,
				})
			: remainingQuantity === 0;

		if (inventoryPlaced) {
			return {
				type: "placed",
			} satisfies GameSaveSingleItemPlacementResult;
		}

		const reason =
			canPlaceOnBoard &&
			(!canPlaceInInventory || boardPlacedQuantity === 0) &&
			boardHitMaxCount
				? "board:max-count"
				: canPlaceOnBoard &&
						(!canPlaceInInventory || boardPlacedQuantity === 0) &&
						boardRanOutOfSpace
					? "board:full"
					: "inventory:full";

		return yield* Effect.fail(
			GameEngineError.placementFailed(reason, "Placement target is full."),
		);
	},
);
