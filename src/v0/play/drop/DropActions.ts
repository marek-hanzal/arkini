export interface DropActions {
	applyBoardItemToBoardItem(input: {
		expectedSourceItemId: string;
		expectedTargetItemId: string;
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}): Promise<unknown>;
	applyInventoryItemToBoardItem(input: {
		expectedSourceItemId: string;
		expectedSourceStackId: string;
		expectedTargetItemId: string;
		sourceSlotIndex: number;
		targetBoardItemId: string;
	}): Promise<unknown>;
	moveBoardItem(input: {
		boardItemId: string;
		expectedItemId: string;
		x: number;
		y: number;
	}): Promise<unknown>;
	storeBoardItem(input: { boardItemId: string; expectedItemId: string }): Promise<unknown>;
	placeInventoryItem(input: {
		expectedItemId: string;
		expectedStackId: string;
		placementMode?: "exact" | "nearest_by_manhattan";
		quantity?: number;
		slotIndex: number;
		x: number;
		y: number;
	}): Promise<unknown>;
	swapBoardItems(input: {
		expectedSourceItemId: string;
		expectedTargetItemId: string;
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}): Promise<unknown>;
	swapInventorySlots(input: {
		expectedSourceItemId: string;
		expectedSourceStackId: string;
		expectedTargetItemId?: string;
		expectedTargetStackId?: string;
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}): Promise<unknown>;
}
