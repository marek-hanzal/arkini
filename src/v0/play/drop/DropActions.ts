export interface DropActions {
	applyBoardItemToBoardItem(input: {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}): Promise<unknown>;
	applyInventoryItemToBoardItem(input: {
		sourceSlotIndex: number;
		targetBoardItemId: string;
	}): Promise<unknown>;
	moveBoardItem(input: { boardItemId: string; x: number; y: number }): Promise<unknown>;
	placeInventoryItem(input: {
		placementMode?: "exact" | "nearest_by_manhattan";
		quantity?: number;
		slotIndex: number;
		x: number;
		y: number;
	}): Promise<unknown>;
	swapBoardItems(input: {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}): Promise<unknown>;
	swapInventorySlots(input: {
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}): Promise<unknown>;
}
