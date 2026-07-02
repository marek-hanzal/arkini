import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { placeInitialInventoryItemFx } from "~/placement/placeInitialInventoryItemFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";

export namespace createInitialGameSaveFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
	}
}

export const createInitialGameSaveFx = Effect.fn("createInitialGameSaveFx")(function* ({
	config,
	nowMs,
}: createInitialGameSaveFx.Props) {
	const boardItems: GameSave["board"]["items"] = {};
	const occupiedCells = new Set<string>();
	const boardItemCountByItemId = new Map<string, number>();
	let initialItemInstanceIndex = 1;

	for (const entry of config.startingState.board) {
		if (
			!isItemStorageAllowed({
				config,
				itemId: entry.itemId,
				location: "board",
			})
		) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(`Starting board cannot contain "${entry.itemId}".`),
			);
		}

		const cellKey = `${entry.x}:${entry.y}`;

		if (occupiedCells.has(cellKey)) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(`Duplicate starting board cell "${cellKey}".`),
			);
		}

		const currentItemCount = boardItemCountByItemId.get(entry.itemId) ?? 0;
		const maxCount = config.items[entry.itemId]?.maxCount;
		if (maxCount !== undefined && currentItemCount >= maxCount) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Starting board has too many item(s) of "${entry.itemId}" for maxCount ${maxCount}.`,
				),
			);
		}

		occupiedCells.add(cellKey);
		boardItemCountByItemId.set(entry.itemId, currentItemCount + 1);
		const id = `item-instance:${initialItemInstanceIndex}`;
		initialItemInstanceIndex += 1;
		boardItems[id] = {
			...(config.items[entry.itemId]?.effects?.length
				? {
						createdAtMs: nowMs,
					}
				: {}),
			id,
			itemId: entry.itemId,
			x: entry.x,
			y: entry.y,
		};
	}

	const inventorySlots: GameSaveInventorySlot[] = Array.from(
		{
			length: config.game.inventory.slots,
		},
		() => null,
	);

	for (const entry of config.startingState.inventory) {
		yield* placeInitialInventoryItemFx({
			config,
			inventorySlots,
			itemId: entry.itemId,
			nowMs,
			quantity: entry.quantity,
		});
	}

	const save: GameSave = {
		activeEffects: {},
		board: {
			items: boardItems,
		},
		createdAtMs: nowMs,
		cheats: {
			speedMode: "normal",
		},
		craftInputs: {},
		craftJobs: {},
		gameId: config.game.id,
		inventory: {
			slots: inventorySlots,
		},
		producerJobs: {},
		lines: {},
		producerInputs: {},
		producerCharges: {},
		itemSpawnJobs: {},
		updatedAtMs: nowMs,
		version: 1,
	};

	return save;
});
