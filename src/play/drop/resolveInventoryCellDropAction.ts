import { cellKey } from "~/board/cellKey";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export type InventoryCellDropAction =
	| {
			type: "reject";
			feedback:
				| {
						kind: "board-cell";
						cellKey: string;
				  }
				| {
						kind: "inventory-slot";
						slotIndex: number;
				  };
	  }
	| {
			type: "apply-inventory-item-to-board-item";
			feedback?: {
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				expectedSourceItemId: string;
				expectedSourceStackId: string;
				expectedTargetItemId: string;
				sourceSlotIndex: number;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "place-inventory-item";
			input: {
				expectedItemId: string;
				expectedStackId: string;
				slotIndex: number;
				x: number;
				y: number;
			};
	  };

export namespace resolveInventoryCellDropAction {
	export interface Props {
		board: BoardView;
		config: GameConfig;
		source: Extract<
			DragSource,
			{
				kind: "inventory";
			}
		>;
		target: Extract<
			DropTarget,
			{
				kind: "cell";
			}
		>;
		inventory: InventoryView;
	}
}

export const resolveInventoryCellDropAction = ({
	board,
	config,
	inventory,
	source,
	target,
}: resolveInventoryCellDropAction.Props): InventoryCellDropAction => {
	const targetCellKey = cellKey(target.x, target.y);
	const sourceSlot = inventory.bySlotIndex[String(source.slotIndex)];
	if (
		!sourceSlot?.stack ||
		sourceSlot.stack.id !== source.slot.stack?.id ||
		sourceSlot.stack.itemId !== source.itemId
	) {
		return {
			feedback: {
				kind: "inventory-slot",
				slotIndex: source.slotIndex,
			},
			type: "reject",
		};
	}

	const targetItem = board.byCellKey[targetCellKey];
	if (targetItem) {
		const plan = resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId: sourceSlot.stack.itemId,
			targetItem,
		});
		if (plan.type === "reject" || plan.type === "swap") {
			return {
				feedback: {
					kind: "board-cell",
					cellKey: targetCellKey,
				},
				type: "reject",
			};
		}

		const input = {
			expectedSourceItemId: sourceSlot.stack.itemId,
			expectedSourceStackId: sourceSlot.stack.id,
			expectedTargetItemId: targetItem.itemId,
			sourceSlotIndex: source.slotIndex,
			targetBoardItemId: targetItem.id,
		};

		if (plan.type === "merge" || plan.type === "producer-input") {
			return {
				input,
				type: "apply-inventory-item-to-board-item",
			};
		}

		return {
			feedback: {
				cellKey: targetCellKey,
				variant: plan.feedbackVariant,
			},
			input,
			type: "apply-inventory-item-to-board-item",
		};
	}

	if (
		!isItemStorageAllowed({
			config,
			itemId: sourceSlot.stack.itemId,
			location: "board",
		})
	) {
		return {
			feedback: {
				kind: "board-cell",
				cellKey: targetCellKey,
			},
			type: "reject",
		};
	}

	return {
		input: {
			expectedItemId: sourceSlot.stack.itemId,
			expectedStackId: sourceSlot.stack.id,
			slotIndex: source.slotIndex,
			x: target.x,
			y: target.y,
		},
		type: "place-inventory-item",
	};
};
