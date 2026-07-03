import type { ItemId } from "~/config/GameIdSchema";

export const boardMemoryItemId = "item:board-memory" satisfies ItemId;

export const isBoardMemoryItemId = (itemId: string): boolean => itemId === boardMemoryItemId;
