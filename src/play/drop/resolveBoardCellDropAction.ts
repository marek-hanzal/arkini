import { cellKey } from "~/board/cellKey";
import { cheatBoardItemId, isInventoryBoardItemId } from "~/board/BoardUtilityItem";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import type {
	BoardCellDropAction,
	ResolveBoardCellDropActionProps,
} from "~/play/drop/BoardCellDropAction";
import {
	createBoardCellRejectDropAction,
	createBoardItemToBoardItemActionInput,
	createDeleteBoardItemDropAction,
	createMoveBoardItemDropAction,
} from "~/play/drop/createBoardCellDropActions";
import { resolveBoardItemInteractionPlanDropAction } from "~/play/drop/resolveBoardItemInteractionPlanDropAction";
import { resolveInventoryUtilityBoardCellDropAction } from "~/play/drop/resolveInventoryUtilityBoardCellDropAction";

export namespace resolveBoardCellDropAction {
	export type Props = ResolveBoardCellDropActionProps;
}

export const resolveBoardCellDropAction = ({
	board,
	config,
	inventory,
	source,
	target,
}: resolveBoardCellDropAction.Props): BoardCellDropAction => {
	const targetCellKey = cellKey(target.x, target.y);
	const sourceItem = readExpectedBoardViewItem({
		board,
		expectedItemId: source.itemId,
		itemInstanceId: source.boardItemId,
	});
	if (!sourceItem) return createBoardCellRejectDropAction(targetCellKey);

	const targetItem = board.byCellKey[targetCellKey];
	if (targetItem?.id === source.boardItemId) {
		return {
			type: "ignore",
		};
	}

	if (!targetItem) {
		return createMoveBoardItemDropAction({
			source,
			sourceItem,
			target,
		});
	}

	if (targetItem.itemId === cheatBoardItemId) {
		return createDeleteBoardItemDropAction({
			source,
			sourceItem,
			targetCellKey,
		});
	}

	if (isInventoryBoardItemId(targetItem.itemId)) {
		return resolveInventoryUtilityBoardCellDropAction({
			config,
			inventory,
			source,
			sourceItem,
			targetCellKey,
		});
	}

	return resolveBoardItemInteractionPlanDropAction({
		input: createBoardItemToBoardItemActionInput({
			source,
			sourceItem,
			targetItem,
		}),
		plan: resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId: sourceItem.itemId,
			sourceQuantity: sourceItem.quantity ?? 1,
			targetItem,
		}),
		targetCellKey,
	});
};
