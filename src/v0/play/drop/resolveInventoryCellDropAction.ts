import { cellKey } from "~/v0/board/cellKey";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

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
				sourceSlotIndex: number;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "place-inventory-item";
			input: {
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
	const sourceSlot = inventory.bySlotIndex[String(source.slotIndex)];
	if (!sourceSlot?.stack) {
		return {
			feedback: {
				kind: "inventory-slot",
				slotIndex: source.slotIndex,
			},
			type: "reject",
		};
	}

	if (target.boardItemId) {
		const targetItem = board.byId[target.boardItemId];
		if (!targetItem) {
			return {
				feedback: {
					kind: "board-cell",
					cellKey: cellKey(target.x, target.y),
				},
				type: "reject",
			};
		}

		const plan = resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId: source.itemId,
			targetItem,
		});
		if (plan.type === "reject" || plan.type === "swap") {
			return {
				feedback: {
					kind: "board-cell",
					cellKey: cellKey(target.x, target.y),
				},
				type: "reject",
			};
		}

		return {
			feedback:
				plan.type === "merge"
					? undefined
					: {
							cellKey: cellKey(target.x, target.y),
							variant: plan.feedbackVariant,
						},
			input: {
				sourceSlotIndex: source.slotIndex,
				targetBoardItemId: target.boardItemId,
			},
			type: "apply-inventory-item-to-board-item",
		};
	}

	if (
		!isItemStorageAllowed({
			config,
			itemId: source.itemId,
			location: "board",
		})
	) {
		return {
			feedback: {
				kind: "board-cell",
				cellKey: cellKey(target.x, target.y),
			},
			type: "reject",
		};
	}

	return {
		input: {
			slotIndex: source.slotIndex,
			x: target.x,
			y: target.y,
		},
		type: "place-inventory-item",
	};
};
