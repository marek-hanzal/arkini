import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { placeInitialInventoryItemFx } from "~/v0/game/engine/fx/placeInitialInventoryItemFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

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
	let nextItemInstanceIndex = 1;

	for (const entry of config.startingState.board) {
		const cellKey = `${entry.x}:${entry.y}`;

		if (occupiedCells.has(cellKey)) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(`Duplicate starting board cell "${cellKey}".`),
			);
		}

		occupiedCells.add(cellKey);
		const id = `item-instance:${nextItemInstanceIndex}`;
		nextItemInstanceIndex += 1;
		boardItems[id] = {
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
			quantity: entry.quantity,
		});
	}

	const save: GameSave = {
		board: {
			items: boardItems,
		},
		createdAtMs: nowMs,
		craftJobs: {},
		gameId: config.game.id,
		inventory: {
			slots: inventorySlots,
		},
		nextItemInstanceIndex,
		nextJobIndex: 1,
		nextScheduledEventIndex: 1,
		producerJobs: {},
		scheduledEvents: {},
		stashes: {},
		updatedAtMs: nowMs,
		version: 1,
	};

	return save;
});
