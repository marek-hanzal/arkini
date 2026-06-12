import type { GameDataManifest } from "../gameDataManifest";
import type { ItemId } from "../manifestId";
import { assert, assertUnique } from "./assert";

export function assertStartingState(manifest: GameDataManifest, itemIds: Set<ItemId>) {
  assert(manifest.startingState.inventory.length <= manifest.game.inventory.slots, "Starting inventory has more stacks than available slots");
  for (const stack of manifest.startingState.inventory) {
    assert(itemIds.has(stack.itemId), `Starting inventory references missing ${stack.itemId}`);
    const item = itemByIdOrThrow(itemIds, manifest, stack.itemId);
    assert(stack.quantity > 0, `Starting inventory ${stack.itemId} quantity must be positive`);
    assert(stack.quantity <= item.maxStackSize, `Starting inventory ${stack.itemId} exceeds max stack size`);
  }

  const occupied = new Set<string>();
  for (const boardItem of manifest.startingState.board) {
    assert(itemIds.has(boardItem.itemId), `Starting board references missing ${boardItem.itemId}`);
    assert(boardItem.x >= 0 && boardItem.y >= 0 && boardItem.x < manifest.game.board.width && boardItem.y < manifest.game.board.height, `Starting board item ${boardItem.itemId} is outside the board`);
    assertUnique(occupied, `${boardItem.x}:${boardItem.y}`, "starting board cell");
  }
}

function itemByIdOrThrow(itemIds: Set<ItemId>, manifest: GameDataManifest, itemId: ItemId) {
  assert(itemIds.has(itemId), `Unknown item ${itemId}`);
  const item = manifest.items.find((candidate) => candidate.id === itemId);
  assert(item, `Unknown item ${itemId}`);
  return item;
}
