import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { BoardCellDropAction } from "~/play/drop/BoardCellDropAction";
import {
	createBoardCellRejectDropAction,
	createStoreBoardItemInInventoryDropAction,
} from "~/play/drop/createBoardCellDropActions";
import { readBoardItemInventoryStorageReadiness } from "~/play/drop/readBoardItemInventoryStorageReadiness";

export const resolveInventoryUtilityBoardCellDropAction = ({
	config,
	inventory,
	source,
	sourceItem,
	targetCellKey,
}: {
	config: GameConfig;
	inventory: InventoryView;
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetCellKey: string;
}): BoardCellDropAction => {
	const readiness = readBoardItemInventoryStorageReadiness({
		config,
		inventory,
		sourceItem,
	});

	if (!readiness.canStore) return createBoardCellRejectDropAction(targetCellKey);

	return createStoreBoardItemInInventoryDropAction({
		source,
		sourceItem,
		targetCellKey,
	});
};
