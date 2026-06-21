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
				x: number;
				y: number;
			};
	  }
	| {
			type: "swap-board-items";
			animation: "parallel-swap";
			input: {
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

	if (target.boardItemId === source.boardItemId) {
		return {
			type: "ignore",
		};
	}

	if (!target.boardItemId) {
		return {
			type: "move-board-item",
			input: {
				boardItemId: source.boardItemId,
				x: target.x,
				y: target.y,
			},
		};
	}

	const targetItem = board.byId[target.boardItemId];
	if (!targetItem) {
		return {
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: targetCellKey,
			},
		};
	}

	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId: source.itemId,
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
				sourceBoardItemId: source.boardItemId,
				targetBoardItemId: targetItem.id,
			},
		};
	}

	return {
		type: "apply-board-item-to-board-item",
		feedback:
			plan.type === "producer-input"
				? undefined
				: {
						cellKey: targetCellKey,
						kind: "cell-feedback",
						variant: plan.feedbackVariant,
					},
		input: {
			sourceBoardItemId: source.boardItemId,
			targetBoardItemId: targetItem.id,
		},
	};
};
