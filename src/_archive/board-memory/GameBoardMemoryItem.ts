import type { ItemId } from "~/config/IdSchema";

export const boardMemoryItemId = "item:board-memory" satisfies ItemId;

export const isBoardMemoryItemId = (itemId: string): boolean => itemId === boardMemoryItemId;
