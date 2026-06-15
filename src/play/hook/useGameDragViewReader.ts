import { useCallback } from "react";
import type { GameDragView } from "~/drag/view/GameDragViewSchema";
import { useBoardView } from "~/board/hook/useBoardView";
import { useInventoryView } from "~/inventory/hook/useInventoryView";

export const useGameDragViewReader = () => {
	const board = useBoardView();
	const inventory = useInventoryView();

	return useCallback(
		(): GameDragView => ({
			boardItemsById: board.byId,
			inventoryBySlotIndex: inventory.bySlotIndex,
		}),
		[
			board.byId,
			inventory.bySlotIndex,
		],
	);
};
