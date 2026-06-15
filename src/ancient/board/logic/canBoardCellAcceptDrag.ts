import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { resolveItemMergeRule } from "~/manifest/logic/resolveItemMergeRule";
import type { DragData } from "~/play/types";

export namespace canBoardCellAcceptDrag {
	export interface Props {
		activeDrag?: DragData;
		boardItem?: BoardViewItem;
	}
}

export const canBoardCellAcceptDrag = ({
	activeDrag,
	boardItem,
}: canBoardCellAcceptDrag.Props): boolean => {
	if (!activeDrag || activeDrag.source.kind !== "board" || !boardItem) return false;
	if (boardItem.id === activeDrag.source.boardItemId) return false;

	return (
		Boolean(resolveItemMergeRule(activeDrag.itemId, boardItem.itemId)) ||
		Boolean(
			boardItem.craft?.canAcceptInputs &&
				boardItem.craft.acceptedInputItemIds.includes(activeDrag.itemId),
		) ||
		Boolean(
			boardItem.activation?.inputs.some(
				(input) => input.itemId === activeDrag.itemId && input.stored < input.capacity,
			),
		)
	);
};
