import {
	readSingleItemBoardStorageAllowed,
	readSingleItemInventoryStorageAllowed,
} from "~/placement/readSinglePlacementStorageAllowed";
import type {
	BoardPlacementProgress,
	SingleItemPlacementScope,
} from "~/placement/SingleGameSaveItemPlacementTypes";

export const readSinglePlacementFailureReason = ({
	progress,
	scope,
}: {
	progress: BoardPlacementProgress;
	scope: SingleItemPlacementScope;
}) => {
	const canPlaceOnBoard = readSingleItemBoardStorageAllowed(scope);
	const canPlaceInInventory = readSingleItemInventoryStorageAllowed(scope);
	if (canPlaceOnBoard && (!canPlaceInInventory || progress.placedQuantity === 0)) {
		return progress.stopReason ?? "board:full";
	}
	return "inventory:full" as const;
};
