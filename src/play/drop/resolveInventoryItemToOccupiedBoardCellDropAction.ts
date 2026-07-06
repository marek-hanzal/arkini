import { match } from "ts-pattern";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import { createBoardCellRejectDropAction } from "~/play/drop/createInventoryCellDropActions";
import type {
	InventoryCellDropAction,
	InventoryItemToBoardItemDropInput,
	SourceInventorySlotWithStack,
} from "~/play/drop/InventoryCellDropAction";

export const resolveInventoryItemToOccupiedBoardCellDropAction = ({
	config,
	input,
	sourceSlot,
	targetCellKey,
	targetItem,
}: {
	config: GameConfig;
	input: InventoryItemToBoardItemDropInput;
	sourceSlot: SourceInventorySlotWithStack;
	targetCellKey: string;
	targetItem: BoardViewItem;
}): InventoryCellDropAction => {
	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId: sourceSlot.stack.itemId,
		sourceQuantity: 1,
		targetItem,
	});

	return match(plan)
		.with(
			{
				type: "reject",
			},
			{
				type: "swap",
			},
			() => createBoardCellRejectDropAction(targetCellKey),
		)
		.with(
			{
				type: "merge",
			},
			{
				type: "stack",
			},
			{
				type: "producer-input",
			},
			() => ({
				input,
				type: "apply-inventory-item-to-board-item" as const,
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
			(matchedPlan) => ({
				feedback: {
					cellKey: targetCellKey,
					variant: matchedPlan.feedbackVariant,
				},
				input,
				type: "apply-inventory-item-to-board-item" as const,
			}),
		)
		.exhaustive();
};
