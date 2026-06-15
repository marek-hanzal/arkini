import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameDragView } from "~/drag/view/GameDragViewSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { playQueryKeys } from "~/play/hook/playQueryKeys";

export const useGameDragViewReader = () => {
	const queryClient = useQueryClient();

	return useCallback((): GameDragView | undefined => {
		const board = queryClient.getQueryData<BoardView>(playQueryKeys.board);
		const inventory = queryClient.getQueryData<InventoryView>(playQueryKeys.inventory);

		if (!board || !inventory) return undefined;

		return {
			boardItemsById: board.byId,
			inventoryBySlotIndex: inventory.bySlotIndex,
		};
	}, [
		queryClient,
	]);
};
