import type { ItemId } from "~/v0/game/config/GameIdSchema";

export const inventoryBoardItemId = "item:inventory" satisfies ItemId;

export const isInventoryBoardItemId = (itemId: ItemId): boolean => itemId === inventoryBoardItemId;
