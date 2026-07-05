import { readBoardUtilityItemSheet } from "~/board/BoardUtilityItem";
import { isBoardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export const readBoardItemSheet = ({
	boardItemId,
	itemId,
}: {
	boardItemId: string;
	itemId: string;
}): ActiveSheetState => {
	if (isBoardMemoryItemId(itemId)) {
		return {
			boardItemId,
			type: "board-memory",
		};
	}

	return (
		readBoardUtilityItemSheet(itemId) ?? {
			boardItemId,
			type: "item",
		}
	);
};
