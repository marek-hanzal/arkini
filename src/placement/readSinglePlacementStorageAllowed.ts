import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { SingleItemPlacementScope } from "~/placement/SingleGameSaveItemPlacementTypes";

export const readSingleItemBoardStorageAllowed = (scope: SingleItemPlacementScope) =>
	isItemStorageAllowed({
		config: scope.config,
		itemId: scope.item.itemId,
		location: "board",
	});

export const readSingleItemInventoryStorageAllowed = (scope: SingleItemPlacementScope) =>
	isItemStorageAllowed({
		config: scope.config,
		itemId: scope.item.itemId,
		location: "inventory",
	});
