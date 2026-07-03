import { cellKey } from "~/board/cellKey";
import { cheatBoardItemId, isInventoryBoardItemId } from "~/board/BoardUtilityItem";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { readBoardItemInventoryStorageReadiness } from "~/play/drop/readBoardItemInventoryStorageReadiness";

export type BoardCellDropAction =
	| {
			type: "ignore";
	  }
	| {
			type: "reject";
			feedback: {
				kind: "board-cell";
				cellKey: string;
			};
	  }
	| {
			type: "delete-board-item";
			animation: "consume";
			feedback: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				boardItemId: string;
				expectedItemId: string;
			};
	  }
	| {
			type: "move-board-item";
			input: {
				boardItemId: string;
				expectedItemId: string;
				x: number;
				y: number;
			};
	  }
	| {
			type: "swap-board-items";
			animation: "parallel-swap";
			input: {
				expectedSourceItemId: string;
				expectedTargetItemId: string;
				sourceBoardItemId: string;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "merge-board-items";
			animation: "parallel-merge";
			feedback?: {
				kind: "merge-cell";
				cellKey: string;
			};
			input: {
				expectedSourceItemId: string;
				expectedTargetItemId: string;
				sourceBoardItemId: string;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "apply-board-item-to-board-item";
			feedback?: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				expectedSourceItemId: string;
				expectedTargetItemId: string;
				sourceBoardItemId: string;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "store-board-item-in-inventory";
			feedback: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				boardItemId: string;
				expectedItemId: string;
			};
	  };

export namespace resolveBoardCellDropAction {
	export interface Props {
		source: Extract<
			DragSource,
			{
				kind: "board";
			}
		>;
		target: Extract<
			DropTarget,
			{
				kind: "cell";
			}
		>;
		board: BoardView;
		config: GameConfig;
		inventory: InventoryView;
	}
}

export const resolveBoardCellDropAction = ({
	board,
	config,
	inventory,
	source,
	target,
}: resolveBoardCellDropAction.Props): BoardCellDropAction => {
	const targetCellKey = cellKey(target.x, target.y);
	const sourceItem = board.byId[source.boardItemId];

	if (sourceItem && sourceItem.itemId !== source.itemId) {
		return {
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: targetCellKey,
			},
		};
	}

	if (!sourceItem) {
		return {
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: targetCellKey,
			},
		};
	}

	const targetItem = board.byCellKey[targetCellKey];

	if (targetItem?.id === source.boardItemId) {
		return {
			type: "ignore",
		};
	}

	if (!targetItem) {
		return {
			type: "move-board-item",
			input: {
				boardItemId: source.boardItemId,
				expectedItemId: sourceItem.itemId,
				x: target.x,
				y: target.y,
			},
		};
	}

	if (targetItem.itemId === cheatBoardItemId) {
		return {
			animation: "consume",
			feedback: {
				cellKey: targetCellKey,
				kind: "cell-feedback",
				variant: "danger",
			},
			input: {
				boardItemId: source.boardItemId,
				expectedItemId: sourceItem.itemId,
			},
			type: "delete-board-item",
		};
	}

	if (isInventoryBoardItemId(targetItem.itemId)) {
		const readiness = readBoardItemInventoryStorageReadiness({
			config,
			inventory,
			sourceItem,
		});

		if (!readiness.canStore) {
			return {
				feedback: {
					cellKey: targetCellKey,
					kind: "board-cell",
				},
				type: "reject",
			};
		}

		return {
			feedback: {
				cellKey: targetCellKey,
				kind: "cell-feedback",
				variant: "primary",
			},
			input: {
				boardItemId: source.boardItemId,
				expectedItemId: sourceItem.itemId,
			},
			type: "store-board-item-in-inventory",
		};
	}

	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId: sourceItem.itemId,
		targetItem,
	});

	if (plan.type === "reject") {
		return {
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: targetCellKey,
			},
		};
	}

	if (plan.type === "swap") {
		return {
			type: "swap-board-items",
			animation: "parallel-swap",
			input: {
				expectedSourceItemId: sourceItem.itemId,
				expectedTargetItemId: targetItem.itemId,
				sourceBoardItemId: source.boardItemId,
				targetBoardItemId: targetItem.id,
			},
		};
	}

	if (plan.type === "merge") {
		return {
			type: "merge-board-items",
			animation: "parallel-merge",
			feedback: {
				kind: "merge-cell",
				cellKey: targetCellKey,
			},
			input: {
				expectedSourceItemId: sourceItem.itemId,
				expectedTargetItemId: targetItem.itemId,
				sourceBoardItemId: source.boardItemId,
				targetBoardItemId: targetItem.id,
			},
		};
	}

	const input = {
		expectedSourceItemId: sourceItem.itemId,
		expectedTargetItemId: targetItem.itemId,
		sourceBoardItemId: source.boardItemId,
		targetBoardItemId: targetItem.id,
	};

	if (plan.type === "producer-input") {
		return {
			input,
			type: "apply-board-item-to-board-item",
		};
	}

	return {
		type: "apply-board-item-to-board-item",
		feedback: {
			cellKey: targetCellKey,
			kind: "cell-feedback",
			variant: plan.feedbackVariant,
		},
		input,
	};
};
