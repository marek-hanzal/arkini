import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave, GameSaveInventorySlot } from "~/v0/game/engine/model/GameSaveSchema";
import { cloneGameSave } from "~/v0/game/engine/logic/cloneGameSave";
import { createGameItemInstanceId } from "~/v0/game/engine/logic/createGameItemInstanceId";
import { findFirstEmptyBoardCell } from "~/v0/game/engine/logic/findFirstEmptyBoardCell";

export interface GameSaveItemPlacementRequest {
	itemId: string;
	quantity: number;
	reason: Extract<
		GameEvent,
		{
			type: "item.created";
		}
	>["reason"];
	originItemInstanceId?: string;
}

export type PlaceGameSaveItemsResult =
	| {
			type: "placed";
			save: GameSave;
			events: GameEvent[];
	  }
	| {
			type: "blocked";
			reason: "placement_unavailable";
	  };

export const placeGameSaveItems = ({
	config,
	save,
	items,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	items: GameSaveItemPlacementRequest[];
	nowMs: number;
}): PlaceGameSaveItemsResult => {
	const nextSave = cloneGameSave(save);
	const events: GameEvent[] = [];

	for (const item of items) {
		const placed = placeSingleItemRequest({
			config,
			events,
			item,
			save: nextSave,
		});

		if (!placed) {
			return {
				type: "blocked",
				reason: "placement_unavailable",
			};
		}
	}

	nextSave.updatedAtMs = nowMs;

	return {
		type: "placed",
		save: nextSave,
		events,
	};
};

const placeSingleItemRequest = ({
	config,
	save,
	events,
	item,
}: {
	config: GameConfig;
	save: GameSave;
	events: GameEvent[];
	item: GameSaveItemPlacementRequest;
}) => {
	const itemDefinition = config.items[item.itemId];

	if (!itemDefinition) {
		return false;
	}

	let remainingQuantity = item.quantity;

	while (remainingQuantity > 0) {
		const emptyCell = findFirstEmptyBoardCell(config, save);

		if (!emptyCell) {
			break;
		}

		const itemInstanceId = createGameItemInstanceId(save);
		save.board.items[itemInstanceId] = {
			id: itemInstanceId,
			itemId: item.itemId,
			x: emptyCell.x,
			y: emptyCell.y,
		};
		events.push({
			type: "item.created",
			itemId: item.itemId,
			originItemInstanceId: item.originItemInstanceId,
			reason: item.reason,
			to: {
				kind: "board",
				itemInstanceId,
				x: emptyCell.x,
				y: emptyCell.y,
			},
		});
		remainingQuantity -= 1;
	}

	return placeInventoryRemainder({
		events,
		item,
		maxStackSize: itemDefinition.maxStackSize,
		remainingQuantity,
		slots: save.inventory.slots,
	});
};

const placeInventoryRemainder = ({
	events,
	item,
	maxStackSize,
	remainingQuantity,
	slots,
}: {
	events: GameEvent[];
	item: GameSaveItemPlacementRequest;
	maxStackSize: number;
	remainingQuantity: number;
	slots: GameSaveInventorySlot[];
}) => {
	let remaining = remainingQuantity;

	for (let slotIndex = 0; slotIndex < slots.length && remaining > 0; slotIndex += 1) {
		const slot = slots[slotIndex];

		if (!slot || slot.itemId !== item.itemId || slot.quantity >= maxStackSize) {
			continue;
		}

		const placedQuantity = Math.min(maxStackSize - slot.quantity, remaining);
		const previousQuantity = slot.quantity;
		slot.quantity += placedQuantity;
		remaining -= placedQuantity;
		events.push({
			type: "item.created",
			itemId: item.itemId,
			originItemInstanceId: item.originItemInstanceId,
			reason: item.reason,
			to: {
				kind: "inventory",
				nextQuantity: slot.quantity,
				previousQuantity,
				quantity: placedQuantity,
				slotIndex,
			},
		});
	}

	for (let slotIndex = 0; slotIndex < slots.length && remaining > 0; slotIndex += 1) {
		if (slots[slotIndex]) {
			continue;
		}

		const placedQuantity = Math.min(maxStackSize, remaining);
		slots[slotIndex] = {
			itemId: item.itemId,
			quantity: placedQuantity,
		};
		remaining -= placedQuantity;
		events.push({
			type: "item.created",
			itemId: item.itemId,
			originItemInstanceId: item.originItemInstanceId,
			reason: item.reason,
			to: {
				kind: "inventory",
				nextQuantity: placedQuantity,
				previousQuantity: 0,
				quantity: placedQuantity,
				slotIndex,
			},
		});
	}

	return remaining === 0;
};
