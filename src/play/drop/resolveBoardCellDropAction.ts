import { cellKey } from "~/board/cellKey";
import { cheatBoardItemId, isInventoryBoardItemId } from "~/board/BoardUtilityItem";
import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import { match } from "ts-pattern";
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

	const input = createBoardItemToBoardItemActionInput({
		source,
		sourceItem,
		targetItem,
	});
	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId: sourceItem.itemId,
		sourceQuantity: sourceItem.quantity ?? 1,
		targetItem,
	});

	return match(plan)
		.with(
			{
				type: "reject",
			},
			() => createBoardCellRejectDropAction(targetCellKey),
		)
		.with(
			{
				type: "swap",
			},
			() => ({
				animation: "parallel-swap" as const,
				input,
				type: "swap-board-items" as const,
			}),
		)
		.with(
			{
				type: "merge",
			},
			() => ({
				animation: "parallel-merge" as const,
				feedback: {
					cellKey: targetCellKey,
					kind: "merge-cell" as const,
				},
				input,
				type: "merge-board-items" as const,
			}),
		)
		.with(
			{
				type: "stack",
			},
			() => ({
				input,
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.with(
			{
				type: "producer-input",
			},
			({ consumedQuantity }) => ({
				animation:
					input.sourceQuantity > consumedQuantity
						? ("boomerang" as const)
						: ("remove" as const),
				input: {
					...input,
					consumedQuantity,
				},
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.with(
			{
				type: "craft-input",
			},
			{
				type: "stash-input",
			},
			{
				type: "tile-remove",
			},
			({ consumedQuantity, consumesSource, feedbackVariant }) => ({
				animation: consumesSource
					? input.sourceQuantity > consumedQuantity
						? ("boomerang" as const)
						: ("remove" as const)
					: undefined,
				feedback: {
					cellKey: targetCellKey,
					kind: "cell-feedback" as const,
					variant: feedbackVariant,
				},
				input: {
					...input,
					consumedQuantity,
				},
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.exhaustive();
};
