import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionInventoryItemPlaceSchema } from "~/v0/game/engine/model/GameActionInventoryItemPlaceSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/engine/model/GameSaveInventorySlot";
import type { GameSave, GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkInventoryItemPlaceReadinessFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		save: GameSave;
	}
}

const readEmptyBoardCellCount = ({ config, save }: { config: GameConfig; save: GameSave }) => {
	const boardCellCount = config.game.board.width * config.game.board.height;
	return Math.max(0, boardCellCount - Object.keys(save.board.items).length);
};

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

export const checkInventoryItemPlaceReadinessFx = Effect.fn("checkInventoryItemPlaceReadinessFx")(
	function* ({ action, config, save }: checkInventoryItemPlaceReadinessFx.Props) {
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

		const itemDefinition = config.items[slot.itemId];
		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${slot.itemId}".`),
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
			return {
				itemDefinition,
				slot,
			};
		}

		const nextSlots = save.inventory.slots.map((nextSlot) =>
			nextSlot ? structuredClone(nextSlot) : null,
		);
		const liveSlot = nextSlots[action.slotIndex];
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
				readEmptyBoardCellCount({
					config,
					save,
				}) === 0
			) {
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

		const nextQuantity = liveSlot.quantity - quantity;
		nextSlots[action.slotIndex] =
			nextQuantity > 0
				? {
						...liveSlot,
						quantity: nextQuantity,
					}
				: null;

		const boardCapacity = readEmptyBoardCellCount({
			config,
			save,
		});
		const inventoryCapacity = readInventoryStackCapacity({
			itemId: liveSlot.itemId,
			maxStackSize: itemDefinition.maxStackSize,
			slots: nextSlots,
		});

		if (quantity > boardCapacity + inventoryCapacity) {
			const reason = boardCapacity === 0 ? "board:full" : "inventory:full";
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
