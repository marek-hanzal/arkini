import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/v0/game/config/readGameConfigItemDefinitionFx";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import type { GameActionInventoryItemPlaceSchema } from "~/v0/game/action/GameActionInventoryItemPlaceSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { planEmptyBoardCellsFx } from "~/v0/game/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/v0/game/placement/planItemBoardPlacementCellsFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSave, GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkInventoryItemPlaceReadinessFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

const readEmptyBoardCellCount = ({ config, save }: { config: GameConfig; save: GameSave }) => {
	const boardCellCount = config.game.board.width * config.game.board.height;
	return Math.max(0, boardCellCount - Object.keys(save.board.items).length);
};

const readBoardPlacementCapacity = ({
	config,
	itemId,
	save,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
}) =>
	Math.min(
		readEmptyBoardCellCount({
			config,
			save,
		}),
		readBoardItemMaxCountCapacity({
			config,
			itemId,
			save,
		}),
	);

const readBoardPlacementBlockReason = ({
	config,
	itemId,
	save,
}: {
	config: GameConfig;
	itemId: string;
	save: GameSave;
}) =>
	readBoardItemMaxCountCapacity({
		config,
		itemId,
		save,
	}) <= 0
		? "board:max-count"
		: "board:full";

const readInventoryStackCapacity = ({
	itemId,
	maxStackSize,
	slots,
}: {
	itemId: string;
	maxStackSize: number;
	slots: GameSaveInventorySlot[];
}) =>
	slots.reduce((capacity, slot) => {
		if (!slot) {
			return capacity + maxStackSize;
		}

		if (isGameSaveInventoryStack(slot) && slot.itemId === itemId) {
			return capacity + Math.max(0, maxStackSize - slot.quantity);
		}

		return capacity;
	}, 0);

const readSaveAfterInventoryRemovalPreview = ({
	quantity,
	save,
	slotIndex,
}: {
	quantity: number;
	save: GameSave;
	slotIndex: number;
}): GameSave => {
	const slots = save.inventory.slots.map((slot, index) => {
		if (index !== slotIndex) return slot;
		if (!slot) return null;

		if (isGameSaveInventoryInstance(slot)) return null;

		const nextQuantity = slot.quantity - quantity;
		return nextQuantity > 0
			? {
					...slot,
					quantity: nextQuantity,
				}
			: null;
	});

	return {
		...save,
		inventory: {
			...save.inventory,
			slots,
		},
	};
};

export const checkInventoryItemPlaceReadinessFx = Effect.fn("checkInventoryItemPlaceReadinessFx")(
	function* ({ action, config, nowMs, save }: checkInventoryItemPlaceReadinessFx.Props) {
		if (action.x >= config.game.board.width || action.y >= config.game.board.height) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"unsupported_target",
					"Board cell is outside board.",
				),
			);
		}

		const slot = save.inventory.slots[action.slotIndex];
		if (!slot) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("input_unavailable", "Inventory slot is empty."),
			);
		}

		const itemDefinition = yield* readGameConfigItemDefinitionFx({
			config,
			itemId: slot.itemId,
		});

		if (
			!isItemStorageAllowed({
				config,
				itemId: slot.itemId,
				location: "board",
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"storage_restricted",
					`Item "${slot.itemId}" cannot be placed on board.`,
				),
			);
		}

		const quantity = action.quantity ?? 1;
		const slotQuantity = readGameSaveInventorySlotQuantity(slot);
		if (quantity > slotQuantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_unavailable",
					`Inventory slot has ${slotQuantity} item(s), cannot place ${quantity}.`,
				),
			);
		}

		const saveAfterInventoryRemoval = readSaveAfterInventoryRemovalPreview({
			quantity,
			save,
			slotIndex: action.slotIndex,
		});

		const placementMode = action.placementMode ?? "exact";
		if (placementMode === "exact" && quantity !== 1) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"unsupported_target",
					"Exact inventory placement supports a single item only.",
				),
			);
		}

		const occupied = Object.values(save.board.items).find(
			(entry) => entry.x === action.x && entry.y === action.y,
		);
		if (placementMode === "exact" && occupied) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
			);
		}

		if (placementMode === "exact") {
			if (
				readBoardItemMaxCountCapacity({
					config,
					itemId: slot.itemId,
					save,
				}) <= 0
			) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:max-count",
						`Board already has the maximum allowed count for "${slot.itemId}".`,
					),
				);
			}

			return {
				itemDefinition,
				slot,
			};
		}

		const nextSlots = saveAfterInventoryRemoval.inventory.slots;
		const liveSlot = save.inventory.slots[action.slotIndex];
		if (!liveSlot) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("input_unavailable", "Inventory slot disappeared."),
			);
		}

		if (isGameSaveInventoryInstance(liveSlot)) {
			if (quantity !== 1) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"unsupported_target",
						"Inventory instance placement supports a single item only.",
					),
				);
			}

			if (
				readBoardPlacementCapacity({
					config,
					itemId: liveSlot.itemId,
					save,
				}) === 0
			) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						readBoardPlacementBlockReason({
							config,
							itemId: liveSlot.itemId,
							save,
						}),
						"No board placement target available.",
					),
				);
			}

			const [targetCell] = yield* planItemBoardPlacementCellsFx({
				config,
				itemId: liveSlot.itemId,
				nowMs,
				save: saveAfterInventoryRemoval,
				seedCell: {
					x: action.x,
					y: action.y,
				},
			});
			if (!targetCell) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:full",
						"No board placement target available.",
					),
				);
			}

			return {
				itemDefinition,
				slot,
			};
		}

		const boardCapacity = readBoardPlacementCapacity({
			config,
			itemId: liveSlot.itemId,
			save,
		});
		const boardPlacementCells =
			boardCapacity > 0
				? yield* planItemBoardPlacementCellsFx({
						config,
						itemId: liveSlot.itemId,
						nowMs,
						save: saveAfterInventoryRemoval,
						seedCell: {
							x: action.x,
							y: action.y,
						},
					})
				: [];
		const allowedBoardCapacity = Math.min(boardCapacity, boardPlacementCells.length);
		if (allowedBoardCapacity === 0) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					readBoardPlacementBlockReason({
						config,
						itemId: liveSlot.itemId,
						save,
					}),
					"No board placement target available.",
				),
			);
		}

		const inventoryCapacity = readInventoryStackCapacity({
			itemId: liveSlot.itemId,
			maxStackSize: itemDefinition.maxStackSize,
			slots: nextSlots,
		});

		if (quantity > allowedBoardCapacity + inventoryCapacity) {
			const reason =
				boardCapacity === 0
					? readBoardPlacementBlockReason({
							config,
							itemId: liveSlot.itemId,
							save,
						})
					: "inventory:full";
			return yield* Effect.fail(
				GameEngineError.actionRejected(reason, "No placement target available."),
			);
		}

		return {
			itemDefinition,
			slot,
		};
	},
);
