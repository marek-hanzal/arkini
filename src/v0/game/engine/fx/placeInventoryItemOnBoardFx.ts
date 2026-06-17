import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { createGameItemInstanceIdFx } from "~/v0/game/engine/fx/createGameItemInstanceIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameActionInventoryItemPlaceSchema } from "~/v0/game/engine/model/GameActionInventoryItemPlaceSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeInventoryItemOnBoardFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const placeInventoryItemOnBoardFx = Effect.fn("placeInventoryItemOnBoardFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: placeInventoryItemOnBoardFx.Props) {
	if (action.x >= config.game.board.width || action.y >= config.game.board.height) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is outside board."),
		);
	}

	const slot = save.inventory.slots[action.slotIndex];
	if (!slot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_unavailable", "Inventory slot is empty."),
		);
	}
	if (!config.items[slot.itemId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${slot.itemId}".`),
		);
	}

	const occupied = Object.values(save.board.items).find(
		(entry) => entry.x === action.x && entry.y === action.y,
	);
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

	const nextSave = yield* cloneGameSaveFx({ save });
	const liveSlot = nextSave.inventory.slots[action.slotIndex];
	if (!liveSlot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_unavailable", "Inventory slot disappeared."),
		);
	}
	const previousQuantity = liveSlot.quantity;
	const nextQuantity = previousQuantity - 1;
	if (nextQuantity > 0) {
		liveSlot.quantity = nextQuantity;
	} else {
		nextSave.inventory.slots[action.slotIndex] = null;
	}

	const itemInstanceId = yield* createGameItemInstanceIdFx({ save: nextSave });
	nextSave.board.items[itemInstanceId] = {
		id: itemInstanceId,
		itemId: liveSlot.itemId,
		x: action.x,
		y: action.y,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				from: {
					kind: "inventory" as const,
					nextQuantity,
					previousQuantity,
					quantity: 1,
					slotIndex: action.slotIndex,
				},
				itemId: liveSlot.itemId,
				reason: "inventory-placement" as const,
				type: "item.consumed" as const,
			},
			{
				itemId: liveSlot.itemId,
				reason: "inventory-placement" as const,
				to: {
					kind: "board" as const,
					itemInstanceId,
					x: action.x,
					y: action.y,
				},
				type: "item.created" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({ save: nextSave }),
		save: nextSave,
	} satisfies GameEngineResult;
});
