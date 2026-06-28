import { cellKey } from "~/v0/board/cellKey";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { resolveItemToBoardItemInteractionPlan } from "~/v0/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

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
	}
}

export const resolveBoardCellDropAction = ({
	board,
	config,
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
