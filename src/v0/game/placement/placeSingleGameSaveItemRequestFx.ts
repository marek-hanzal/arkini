import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { createGameItemInstanceIdFx } from "~/v0/game/save/createGameItemInstanceIdFx";
import { findFirstEmptyBoardCellFx } from "~/v0/game/placement/findFirstEmptyBoardCellFx";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import { readGameEffectItemCreateBlockReasons } from "~/v0/game/effects/readGameEffectItemCreateBlockReasons";
import { placeGameSaveInventoryRemainderFx } from "~/v0/game/placement/placeGameSaveInventoryRemainderFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

type GameSaveSingleItemPlacementResult = {
	type: "placed";
};

const checkPlacementEffectBlocksFx = Effect.fn("checkPlacementEffectBlocksFx")(function* ({
	config,
	itemId,
	nowMs,
	save,
	targetCell,
}: {
	config: GameConfig;
	itemId: string;
	nowMs: number;
	save: GameSave;
	targetCell?: BoardCell;
}) {
	const blockReasons = readGameEffectItemCreateBlockReasons({
		config,
		itemId,
		nowMs,
		save,
		targetCell,
	});
	if (blockReasons.length === 0) return;

	const [firstReason] = blockReasons;
	return yield* Effect.fail(
		GameEngineError.placementFailed(
			"effect:block-create",
			firstReason?.reason ??
				`Item "${itemId}" cannot be created while effect "${firstReason?.effectName ?? "unknown"}" is active.`,
		),
	);
});

export namespace placeSingleGameSaveItemRequestFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
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

		yield* checkPlacementEffectBlocksFx({
			config,
			itemId: item.itemId,
			nowMs,
			save,
		});

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
				readBoardItemMaxCountCapacity({
					config,
					itemId: item.itemId,
					save,
				}) <= 0
			) {
				boardHitMaxCount = true;
				break;
			}

			const emptyCell = yield* findFirstEmptyBoardCellFx({
				config,
				save,
				seedCell,
			});

			if (!emptyCell) {
				boardRanOutOfSpace = true;
				break;
			}

			yield* checkPlacementEffectBlocksFx({
				config,
				itemId: item.itemId,
				nowMs,
				save,
				targetCell: emptyCell,
			});

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

		const inventoryPlaced = canPlaceInInventory
			? yield* placeGameSaveInventoryRemainderFx({
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
