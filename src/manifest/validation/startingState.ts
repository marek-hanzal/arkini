import type { GameConfig } from "../GameConfig";
import type { ItemId } from "../manifestId";
import { assert, assertUnique } from "./assert";

export function assertStartingState(config: GameConfig, itemIds: Set<ItemId>) {
	assert(
		config.startingState.inventory.length <= config.game.inventory.slots,
		"Starting inventory has more stacks than available slots",
	);

	for (const stack of config.startingState.inventory) {
		assert(itemIds.has(stack.itemId), `Starting inventory references missing ${stack.itemId}`);
		const item = itemByIdOrThrow(itemIds, config, stack.itemId);
		assert(stack.quantity > 0, `Starting inventory ${stack.itemId} quantity must be positive`);
		assert(
			stack.quantity <= item.maxStackSize,
			`Starting inventory ${stack.itemId} exceeds max stack size`,
		);
	}

	const occupied = new Set<string>();
	for (const boardItem of config.startingState.board) {
		assert(
			itemIds.has(boardItem.itemId),
			`Starting board references missing ${boardItem.itemId}`,
		);
		assert(
			boardItem.x >= 0 &&
				boardItem.y >= 0 &&
				boardItem.x < config.game.board.width &&
				boardItem.y < config.game.board.height,
			`Starting board item ${boardItem.itemId} is outside the board`,
		);
		assertUnique(occupied, `${boardItem.x}:${boardItem.y}`, "starting board cell");
	}
}

function itemByIdOrThrow(itemIds: Set<ItemId>, config: GameConfig, itemId: ItemId) {
	assert(itemIds.has(itemId), `Unknown item ${itemId}`);
	const item = config.items.find((candidate) => candidate.id === itemId);
	assert(item, `Unknown item ${itemId}`);
	return item;
}
