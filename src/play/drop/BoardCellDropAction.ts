import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

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
			animation: "remove";
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
			input: BoardItemToBoardItemActionInput;
	  }
	| {
			type: "merge-board-items";
			animation: "parallel-merge";
			feedback?: {
				kind: "merge-cell";
				cellKey: string;
			};
			input: BoardItemToBoardItemActionInput;
	  }
	| {
			type: "apply-board-item-to-board-item";
			animation?: "boomerang" | "remove";
			feedback?: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: BoardItemToBoardItemActionInput;
	  }
	| {
			type: "store-board-item-in-inventory";
			animation: "remove";
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

export type BoardItemToBoardItemActionInput = {
	consumedQuantity?: number;
	expectedSourceItemId: string;
	expectedTargetItemId: string;
	sourceBoardItemId: string;
	sourceQuantity: number;
	targetBoardItemId: string;
};

export interface ResolveBoardCellDropActionProps {
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
