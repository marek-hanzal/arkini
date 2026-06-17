import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";

export interface CreateInitialGameSaveInput {
	config: GameConfig;
	nowMs: number;
	rngSeed?: number;
}

export const createInitialGameSave = ({
	config,
	nowMs,
	rngSeed = 1,
}: CreateInitialGameSaveInput): GameSave => {
	const boardItems: GameSave["board"]["items"] = {};
	const occupiedCells = new Set<string>();
	let nextItemInstanceIndex = 1;

	for (const entry of config.startingState.board) {
		const cellKey = `${entry.x}:${entry.y}`;

		if (occupiedCells.has(cellKey)) {
			throw new Error(`Duplicate starting board cell "${cellKey}".`);
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
		placeInitialInventoryItem({
			config,
			inventorySlots,
			itemId: entry.itemId,
			quantity: entry.quantity,
		});
	}

	return {
		version: 1,
		gameId: config.game.id,
		createdAtMs: nowMs,
		updatedAtMs: nowMs,
		rngSeed,
		nextItemInstanceIndex,
		nextJobIndex: 1,
		nextScheduledEventIndex: 1,
		board: {
			items: boardItems,
		},
		inventory: {
			slots: inventorySlots,
		},
		producerJobs: {},
		craftJobs: {},
		scheduledEvents: {},
	};
};

const placeInitialInventoryItem = ({
	config,
	inventorySlots,
	itemId,
	quantity,
}: {
	config: GameConfig;
	inventorySlots: GameSaveInventorySlot[];
	itemId: string;
	quantity: number;
}) => {
	const item = config.items[itemId];

	if (!item) {
		throw new Error(`Missing item "${itemId}".`);
	}

	let remainingQuantity = quantity;

	for (const slot of inventorySlots) {
		if (!slot || slot.itemId !== itemId || slot.quantity >= item.maxStackSize) {
			continue;
		}

		const placedQuantity = Math.min(item.maxStackSize - slot.quantity, remainingQuantity);
		slot.quantity += placedQuantity;
		remainingQuantity -= placedQuantity;

		if (remainingQuantity === 0) {
			return;
		}
	}

	for (let slotIndex = 0; slotIndex < inventorySlots.length; slotIndex += 1) {
		if (inventorySlots[slotIndex]) {
			continue;
		}

		const placedQuantity = Math.min(item.maxStackSize, remainingQuantity);
		inventorySlots[slotIndex] = {
			itemId,
			quantity: placedQuantity,
		};
		remainingQuantity -= placedQuantity;

		if (remainingQuantity === 0) {
			return;
		}
	}

	throw new Error(`Starting inventory cannot fit ${quantity} of "${itemId}".`);
};
